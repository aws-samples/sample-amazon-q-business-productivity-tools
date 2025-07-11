// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Config, KendraConfig, QBusinessConfig } from '../types/types';

export function isQBusinessConfig(config: Config): config is QBusinessConfig {
  return config.type === 'QBUSINESS';
}

export function isKendraConfig(config: Config): config is KendraConfig {
  return config.type === 'KENDRA';
}
