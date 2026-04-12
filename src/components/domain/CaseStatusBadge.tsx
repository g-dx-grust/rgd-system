import { Badge } from "@/components/ui";
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_VARIANT,
  type CaseStatus,
} from "@/lib/constants/case-status";

interface Props {
  status: CaseStatus;
}

export function CaseStatusBadge({ status }: Props) {
  return (
    <Badge variant={CASE_STATUS_VARIANT[status]}>
      {CASE_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
