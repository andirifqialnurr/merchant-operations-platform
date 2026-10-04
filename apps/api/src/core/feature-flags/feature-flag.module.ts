import { Module } from "@nestjs/common";

import { FeatureFlagService } from "./feature-flag.service.js";

@Module({ exports: [FeatureFlagService], providers: [FeatureFlagService] })
export class FeatureFlagModule {}
