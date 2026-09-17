#!/usr/bin/env node
/**
 * Normalize Kazhutha dashboard JSON to pass OpenObserve v8 import validation.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = join(__dirname, "kazhutha-overview.dashboard.json");

function cleanCustomAxis(fields) {
  for (const key of ["x", "y", "z", "breakdown"]) {
    if (!Array.isArray(fields[key])) continue;
    fields[key] = fields[key].map((item) => ({
      label: item.label,
      alias: item.alias,
      type: "custom",
    }));
  }
}

function normalizeQuery(query, queryType) {
  delete query.vrlFunctionQuery;

  const fields = query.fields ?? {};
  if (!Array.isArray(fields.z)) fields.z = [];
  if (fields.filter == null) {
    fields.filter = { filterType: "group", logicalOperator: "AND", conditions: [] };
  }
  delete fields.breakdown;

  if (queryType === "promql") {
    query.customQuery = false;
    fields.stream = "";
    fields.stream_type = "metrics";
    fields.x = [];
    fields.y = [];
  } else if (query.customQuery) {
    cleanCustomAxis(fields);
  }

  query.fields = fields;
  // OpenObserve deserializer requires promql_legend on every query config (even SQL).
  query.config = {
    ...(query.config ?? {}),
    promql_legend: query.config?.promql_legend ?? "",
  };
  return query;
}

function normalizePanel(panel) {
  if (!panel.config) panel.config = {};
  if (panel.config.unit === "reqps") panel.config.unit = "numbers";
  if (panel.config.unit === "percent") panel.config.unit = "percent-1";

  panel.queries = (panel.queries ?? []).map((q) => normalizeQuery(q, panel.queryType));
  return panel;
}

const dashboard = JSON.parse(readFileSync(path, "utf8"));

dashboard.version = 8;
dashboard.dashboardId = dashboard.dashboardId || "kazhutha-overview";
delete dashboard.role;
delete dashboard.owner;

for (const tab of dashboard.tabs ?? []) {
  tab.panels = (tab.panels ?? []).map(normalizePanel);
}

writeFileSync(path, `${JSON.stringify(dashboard, null, 2)}\n`);
console.log(`Normalized ${path} (dashboardId=${dashboard.dashboardId}, version=${dashboard.version})`);
