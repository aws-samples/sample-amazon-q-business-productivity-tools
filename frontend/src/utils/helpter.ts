// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

interface StringValue {
  stringValue: string;
}

interface EqualsToFilter {
  equalsTo: {
    name: string;
    value: StringValue;
  };
}

export interface AndAllFilters {
  andAllFilters: EqualsToFilter[];
}

export interface OrAllFilters {
  orAllFilters: AndAllFilters[];
}

export function createDataSourceFilter(stringValues: string[]): OrAllFilters {
  return {
    orAllFilters: stringValues.map((value) => ({
      andAllFilters: [
        {
          equalsTo: {
            name: '_data_source_id',
            value: {
              stringValue: value,
            },
          },
        },
      ],
    })),
  };
}
