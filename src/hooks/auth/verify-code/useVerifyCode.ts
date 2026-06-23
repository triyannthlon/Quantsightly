"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { verifycodeSchema, verifyOtpCode, resendOtpCode } from "@/lib/auth/otp-code";

/************** useVerifyCode *****/
export function useVerifyCode(
  email: string | null,
  form: UseFormReturn<z.infer<typeof verifycodeSchema>>,
) {
  const router = useRouter();

  const [timer, setTimer] = useState(30);
  const [isResending, setIsResending] = useState(false);

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  /* Timer */
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  /* Autofocus on first input */
  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  /**** onSubmit *****/
  const onSubmit = useCallback(
    async (code: string) => {
      try {
        toast.loading("Vérification du code...");

        await verifyOtpCode(email!, code);

        toast.dismiss();
        toast.success("Code correct");

        inputsRef.current.forEach((input) => {
          input?.classList.add("animate-success");
        });

        setTimeout(() => {
          router.push("/home");
        }, 500);
      } catch (err: unknown) {
        toast.dismiss();

        if (err instanceof Error) toast.error(err.message);
        else toast.error("Erreur inconnue");

        /* animation shake */
        inputsRef.current.forEach((input) => {
          input?.classList.add("animate-shake");
          setTimeout(() => input?.classList.remove("animate-shake"), 500);
        });
      }
    },
    [email, router],
  );

  /************* resendCode *****/
  async function resendCode() {
    setIsResending(true);

    try {
      await resendOtpCode(email!);

      toast.dismiss();
      toast.success("Code renvoyé");

      /* les inputs sont vidés */
      inputsRef.current.forEach((input) => {
        if (input) input.value = "";
      });

      form.setValue("code", "");

      inputsRef.current[0]?.focus();

      setTimer(30);
    } catch (err: unknown) {
      toast.dismiss();
      if (err instanceof Error) toast.error(err.message);
      else toast.error("Erreur inconnue");
    }

    setIsResending(false);
  }

  /* Les 6 chiffres ont été saisis */
  useEffect(() => {
    const subscription = form.watch((value) => {
      const code = value.code ?? "";
      if (code.length === 6) {
        void onSubmit(code);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, onSubmit]);

  return { inputsRef, timer, isResending, onSubmit, resendCode };
}
