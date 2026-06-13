import { CheckCircle, Clock, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineNode {
  title: string;
  time?: string;
  operator?: string;
  comment?: string;
  status: "completed" | "current" | "pending";
}

interface TimelineProps {
  nodes: TimelineNode[];
  className?: string;
}

export default function Timeline({ nodes, className }: TimelineProps) {
  return (
    <div className={cn("relative", className)}>
      {nodes.map((node, index) => {
        const isLast = index === nodes.length - 1;

        return (
          <div key={index} className="flex gap-4 animate-slide-in">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
                  node.status === "completed" && "bg-port/20 text-port",
                  node.status === "current" && "bg-nautical/20 text-nautical-light animate-pulse",
                  node.status === "pending" && "bg-gray-700/50 text-gray-500"
                )}
              >
                {node.status === "completed" && <CheckCircle className="w-5 h-5" />}
                {node.status === "current" && <Clock className="w-5 h-5" />}
                {node.status === "pending" && <Circle className="w-5 h-5" />}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-6",
                    node.status === "completed" ? "bg-port/30" : "bg-gray-700/50"
                  )}
                />
              )}
            </div>

            <div className={cn("pb-6", isLast && "pb-0")}>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    node.status === "pending" ? "text-gray-500" : "text-gray-200"
                  )}
                >
                  {node.title}
                </span>
                {node.time && (
                  <span className="text-xs text-gray-500">{node.time}</span>
                )}
              </div>
              {node.operator && (
                <p className="text-xs text-gray-400 mt-0.5">{node.operator}</p>
              )}
              {node.comment && (
                <p className="text-xs text-gray-500 mt-1 bg-navy-lighter/50 rounded px-2 py-1">
                  {node.comment}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
