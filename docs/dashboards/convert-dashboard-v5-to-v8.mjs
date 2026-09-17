#!/usr/bin/env node
/**
 * Converts Kazhutha OpenObserve dashboard JSON from schema v5 to v8.
 * Mirrors openobserve/web convertDashboardSchemaVersion.ts (cases 5→8).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function migrateV7FieldsToV8(fieldItem, isCustomQuery) {
  if (!fieldItem) return;
  const isHistogram = fieldItem.aggregationFunction === "histogram";
  if (!fieldItem.args || !isHistogram) {
    fieldItem.args = [];
  } else {
    fieldItem.args.forEach((arg) => {
      if (!arg.type) arg.type = "histogramInterval";
    });
  }
  if (isCustomQuery) {
    fieldItem.type = "custom";
  } else {
    fieldItem.type = "build";
    fieldItem.args.unshift({
      type: "field",
      value: { field: fieldItem.column, streamAlias: null },
    });
    delete fieldItem.column;
  }
  if (fieldItem.aggregationFunction) {
    fieldItem.functionName = fieldItem.aggregationFunction;
    delete fieldItem.aggregationFunction;
  } else {
    fieldItem.functionName = null;
  }
}

function migrateFields(fields, isCustomQuery, migrateFn) {
  if (Array.isArray(fields)) {
    fields.forEach((field) => migrateFn(field, isCustomQuery));
  } else if (fields) {
    migrateFn(fields, isCustomQuery);
  }
}

function migrateFilterConditions(filter) {
  if (!filter?.conditions || !Array.isArray(filter.conditions)) return filter;
  filter.conditions = filter.conditions.map((condition) => {
    if (condition.filterType === "group") return migrateFilterConditions(condition);
    if (typeof condition.column === "string") {
      condition.column = { streamAlias: null, field: condition.column };
    }
    return condition;
  });
  return filter;
}

function convertV5ToV8(data) {
  const dashboard = structuredClone(data);
  dashboard.version = 5;

  // v5 → v6
  for (const tab of dashboard.tabs ?? []) {
    for (const panel of tab.panels ?? []) {
      if (!panel.layout) continue;
      panel.layout.w *= 4;
      panel.layout.x *= 4;
      panel.layout.h *= 2;
    }
  }
  dashboard.version = 6;

  // v6 → v7
  for (const tab of dashboard.tabs ?? []) {
    for (const panel of tab.panels ?? []) {
      if (!panel.layout) continue;
      panel.layout.y *= 2;
    }
  }
  dashboard.version = 7;

  // v7 → v8
  for (const tab of dashboard.tabs ?? []) {
    for (const panel of tab.panels ?? []) {
      for (const query of panel.queries ?? []) {
        const fields = query.fields ?? {};
        if (!Array.isArray(fields.z)) fields.z = [];
        if (!Array.isArray(fields.breakdown)) fields.breakdown = [];

        const axisKeys = [
          "x",
          "y",
          "z",
          "breakdown",
          "latitude",
          "longitude",
          "weight",
          "source",
          "target",
          "value",
          "name",
          "value_for_maps",
        ];
        for (const key of axisKeys) {
          migrateFields(fields[key], query.customQuery, migrateV7FieldsToV8);
        }
        fields.filter = migrateFilterConditions(fields.filter);
        query.fields = fields;
        if (!query.vrlFunctionQuery) query.vrlFunctionQuery = "";
      }
      if (!panel.config) panel.config = {};
    }
  }
  dashboard.version = 8;
  return dashboard;
}

const input = join(__dirname, "kazhutha-overview.v5.dashboard.json");
const output = join(__dirname, "kazhutha-overview.dashboard.json");
const source = JSON.parse(readFileSync(input, "utf8"));
const converted = convertV5ToV8(source);
writeFileSync(output, `${JSON.stringify(converted, null, 2)}\n`);
console.log(`Wrote ${output} (version ${converted.version})`);
