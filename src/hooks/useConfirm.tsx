import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface PromptOptions extends ConfirmOptions {
  inputLabel?: string;
  defaultValue?: string;
  placeholder?: string;
  inputMode?: "text" | "decimal" | "numeric" | "email" | "tel" | "url" | "search";
}

interface ConfirmCtx {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const Ctx = createContext<ConfirmCtx | null>(null);

interface State extends PromptOptions {
  isPrompt: boolean;
}

const INITIAL_STATE: State = { title: "", isPrompt: false };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [inputValue, setInputValue] = useState("");
  const resolverRef = useRef<((value: boolean | string | null) => void) | null>(null);

  const finish = useCallback((value: boolean | string | null) => {
    setOpen(false);
    const resolver = resolverRef.current;
    resolverRef.current = null;
    resolver?.(value);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = (v) => resolve(v === true);
      setState({ ...opts, isPrompt: false });
      setInputValue("");
      setOpen(true);
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      resolverRef.current = (v) => resolve(typeof v === "string" ? v : null);
      setState({ ...opts, isPrompt: true });
      setInputValue(opts.defaultValue ?? "");
      setOpen(true);
    });
  }, []);

  const handleConfirm = () => finish(state.isPrompt ? inputValue : true);
  const handleCancel = () => finish(state.isPrompt ? null : false);

  return (
    <Ctx.Provider value={{ confirm, prompt }}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) handleCancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state.title}</AlertDialogTitle>
            {state.description && (
              <AlertDialogDescription className="whitespace-pre-line">
                {state.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          {state.isPrompt && (
            <div className="space-y-1.5">
              {state.inputLabel && (
                <Label htmlFor="confirm-prompt-input" className="text-xs">
                  {state.inputLabel}
                </Label>
              )}
              <Input
                id="confirm-prompt-input"
                autoFocus
                value={inputValue}
                placeholder={state.placeholder}
                inputMode={state.inputMode}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {state.cancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(
                state.destructive &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {state.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx;
}
