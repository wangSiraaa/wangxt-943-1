import { AlertTriangle } from "lucide-react";
import { useDataStore, type AlertItem } from "@/store/dataStore";
import { cn } from "@/lib/utils";

const alertStyles: Record<AlertItem["level"], string> = {
  critical: "bg-danger/15 border-danger/40 text-danger-light",
  warning: "bg-warning/15 border-warning/40 text-warning-light",
  info: "bg-yellow-600/15 border-yellow-600/40 text-yellow-400",
};

export default function AlertBanner() {
  const { alerts } = useDataStore();

  if (!alerts || alerts.length === 0) return null;

  const items = [...alerts, ...alerts];

  return (
    <div className="w-full overflow-hidden border-t border-navy-lighter bg-navy-light/80">
      <div className="flex items-center h-9">
        <div className="flex items-center px-3 border-r border-navy-lighter shrink-0">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <span className="ml-1.5 text-xs font-medium text-warning">
            告警
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex animate-scroll-left whitespace-nowrap">
            {items.map((alert, index) => (
              <span
                key={`${alert.id}-${index}`}
                className={cn(
                  "inline-flex items-center mx-3 px-2.5 py-0.5 rounded border text-xs",
                  alertStyles[alert.level]
                )}
              >
                {alert.title} — {alert.message}
                <span className="ml-2 opacity-60">{alert.createdAt}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
