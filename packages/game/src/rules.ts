import { RuleConfig } from "@kazhutha/shared";

export interface RuleFieldDef {
  key: keyof RuleConfig;
  label: string;
  description: string;
}

export const RULE_FIELD_DEFS: RuleFieldDef[] = [
  {
    key: "mustLeadAceOfSpades",
    label: "Must open with Ace of Spades",
    description: "The Ace of Spades holder must lead it in round 1. If off, they may lead any card.",
  },
];
