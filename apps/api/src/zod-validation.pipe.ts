import { type ContractSchema } from "@merchant/contracts";
import { BadRequestException, type PipeTransform } from "@nestjs/common";

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ContractSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        details: {
          issues: result.error.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path,
          })),
        },
        message: "Request tidak valid.",
      });
    }

    return result.data;
  }
}
