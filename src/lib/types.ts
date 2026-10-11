export type Role = "klant" | "team" | "admin";
export type Status = "nieuw" | "in_behandeling" | "afgerond" | "geannuleerd";

export const STATUSES: { value: Status; label: string }[] = [
  { value: "nieuw", label: "Nieuw" },
  { value: "in_behandeling", label: "In behandeling" },
  { value: "afgerond", label: "Afgerond" },
  { value: "geannuleerd", label: "Geannuleerd" },
];

export const statusLabel = (s: Status) => STATUSES.find((x) => x.value === s)!.label;

export type Order = {
  id: number;
  stands: string[];
  description: string;
  status: Status;
  created_at: string;
  updated_at: string;
};

export type OrderEvent = {
  id: number;
  order_id: number;
  author_name: string;
  kind: "created" | "edit" | "status" | "remark";
  body: string;
  created_at: string;
};

export type Profile = { id: string; role: Role; display_name: string };
