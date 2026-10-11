import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { FormField, PinInput } from "./text-field";

function Pin({ length, onComplete }: { length?: number; onComplete?: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <FormField htmlFor="pin" label="PIN manajer">
      <PinInput
        id="pin"
        onValueChange={setValue}
        value={value}
        {...(length ? { length } : {})}
        {...(onComplete ? { onComplete } : {})}
      />
    </FormField>
  );
}

describe("PinInput", () => {
  it("takes digits only, up to its length, and reports the PIN once it is complete", async () => {
    const user = userEvent.setup();
    const complete = vi.fn();
    render(<Pin length={4} onComplete={complete} />);

    const input = screen.getByLabelText("PIN manajer");
    await user.type(input, "1a2");
    expect(input).toHaveValue("12");
    expect(complete).not.toHaveBeenCalled();
    await user.type(input, "3-4");
    expect(input).toHaveValue("1234");
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith("1234");
    // Nothing more fits.
    await user.type(input, "5");
    expect(input).toHaveValue("1234");
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("never shows the digits: the field is masked and the cells only count", async () => {
    const user = userEvent.setup();
    const { container } = render(<Pin />);

    const input = screen.getByLabelText("PIN manajer");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "off");
    await user.type(input, "907");
    expect(container.querySelectorAll(".ui-pin-input__cell")).toHaveLength(6);
    expect(container.querySelectorAll(".ui-pin-input__cell--filled")).toHaveLength(3);
    expect(container.querySelector(".ui-pin-input__cells")).toHaveTextContent("");
    expect(container.querySelector(".ui-pin-input__cells")).toHaveAttribute("aria-hidden", "true");
    await user.type(input, "{Backspace}");
    expect(container.querySelectorAll(".ui-pin-input__cell--filled")).toHaveLength(2);
  });

  it("takes its error from the field around it", () => {
    render(
      <FormField error="PIN salah. Sisa 2 percobaan." htmlFor="pin" label="PIN manajer">
        <PinInput id="pin" onValueChange={() => undefined} value="12" />
      </FormField>,
    );
    const input = screen.getByLabelText("PIN manajer");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("PIN salah. Sisa 2 percobaan.");
  });

  it("passes an axe smoke test", async () => {
    const { container } = render(<Pin />);
    expect((await axe(container)).violations).toEqual([]);
  });
});
