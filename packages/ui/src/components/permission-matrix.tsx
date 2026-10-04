import { Fragment } from "react";
import { IconCheck } from "@tabler/icons-react";

import { AppIcon } from "./app-icon";

export type PermissionMatrixColumn = {
  key: string;
  /** Name of the role, e.g. "Kasir". */
  label: string;
};

export type PermissionMatrixRow = {
  /** Keys of the columns that have this permission. */
  granted: ReadonlySet<string>;
  key: string;
  /** The permission in plain words, e.g. "Menerima pembayaran". */
  label: string;
};

export type PermissionMatrixGroup = {
  key: string;
  /** The part of the business these permissions open, e.g. "Penjualan dan kasir". */
  label: string;
  rows: readonly PermissionMatrixRow[];
};

export type PermissionMatrixProps = {
  /** What the table shows, for people who cannot see it. */
  caption: string;
  columns: readonly PermissionMatrixColumn[];
  /** Read for a cell that has the permission, e.g. "Boleh". */
  grantedLabel: string;
  groups: readonly PermissionMatrixGroup[];
  /** Read for a cell that does not have it, e.g. "Tidak". */
  notGrantedLabel: string;
  /** Header of the first column, e.g. "Izin". */
  permissionLabel: string;
};

/**
 * Who may do what, side by side: permissions down, roles across. It is for
 * reading and comparing; changing a role happens where the role is edited.
 * On a narrow screen the permission names stay in place while the roles scroll.
 */
export function PermissionMatrix({
  caption,
  columns,
  grantedLabel,
  groups,
  notGrantedLabel,
  permissionLabel,
}: PermissionMatrixProps) {
  return (
    <div className="ui-permission-matrix" role="region" aria-label={caption} tabIndex={0}>
      <table>
        <caption className="ui-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{permissionLabel}</th>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.key}>
            <tr className="ui-permission-matrix__group">
              <th colSpan={columns.length + 1} scope="colgroup">
                <span>{group.label}</span>
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                {columns.map((column) => {
                  const granted = row.granted.has(column.key);
                  return (
                    <td data-granted={granted ? "true" : "false"} key={column.key}>
                      {granted ? (
                        <Fragment>
                          <AppIcon icon={IconCheck} size="sm" />
                          <span className="ui-visually-hidden">{grantedLabel}</span>
                        </Fragment>
                      ) : (
                        // An empty cell is quieter than a cross; the words are there for screen readers.
                        <span className="ui-visually-hidden">{notGrantedLabel}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
