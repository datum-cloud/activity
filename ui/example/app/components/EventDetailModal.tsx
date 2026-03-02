import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@miloapis/activity-ui";

interface EventDetailModalProps {
  title: string;
  data: unknown;
  onClose: () => void;
}

/**
 * Modal component for displaying event/activity details as JSON.
 */
export function EventDetailModal({ title, data, onClose }: EventDetailModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          <pre className="p-4 bg-muted rounded-md text-sm overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
