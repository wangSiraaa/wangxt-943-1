import type { VoyageStatus } from '../types';
import { STATUS_LABELS, STATUS_COLORS } from '../types';

interface Props {
  status: VoyageStatus;
}

export default function StatusBadge({ status }: Props) {
  return (
    <span className={`status-badge ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
