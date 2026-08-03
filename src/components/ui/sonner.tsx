import {
  Toaster as SonnerToaster,
  type ToasterProps,
} from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      className="group"
      position="bottom-center"
      visibleToasts={3}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-2xl !border-line !bg-surface-raised !text-ink !shadow-float",
          description: "!text-muted",
          actionButton: "!bg-accent !text-accent-foreground",
          cancelButton: "!bg-surface-hover !text-muted",
        },
      }}
      {...props}
    />
  );
}
