import type { CarbonSection } from "../lib/model";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
} from "./ui/dialog";

export function DeleteBucketDialog({
  bucket,
  onConfirm,
  onOpenChange,
}: {
  bucket: CarbonSection | null;
  onConfirm: (bucketId: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const doneCount =
    bucket?.items.filter((item) => item.completed).length ?? 0;
  const totalCount = bucket?.items.length ?? 0;
  const notDoneCount = totalCount - doneCount;

  return (
    <Dialog open={bucket !== null} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Delete “${bucket?.name ?? "bucket"}”?`}
        description="The bucket and every item inside it will be permanently deleted. This can’t be undone."
      >
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { label: "Total", value: totalCount },
            { label: "Not done", value: notDoneCount },
            { label: "Done", value: doneCount },
          ].map((count) => (
            <div
              className="rounded-xl border border-line bg-surface px-2 py-2.5 text-center"
              key={count.label}
            >
              <strong className="block text-sm font-semibold tabular-nums text-ink">
                {count.value}
              </strong>
              <span className="mt-0.5 block text-xs text-muted">
                {count.label}
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (bucket) onConfirm(bucket.id);
              onOpenChange(false);
            }}
          >
            Delete bucket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
