import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
} from "../../../components/ui/dialog";

export function DeleteDoneDialog({
  count,
  open,
  scopeName,
  onConfirm,
  onOpenChange,
}: {
  count: number;
  open: boolean;
  scopeName: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const noun = count === 1 ? "item" : "items";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Delete ${count} Done ${noun}?`}
        description={`This permanently deletes every Done item from ${scopeName}. This can’t be undone.`}
      >
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
              onConfirm();
              onOpenChange(false);
            }}
          >
            Delete all
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
