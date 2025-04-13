
import { Skeleton } from "@/components/ui/skeleton";

const ActivitySkeleton = () => {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-start py-3 border-b last:border-b-0">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="ml-3 flex-1">
            <div className="flex justify-between">
              <div>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="text-right">
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivitySkeleton;
