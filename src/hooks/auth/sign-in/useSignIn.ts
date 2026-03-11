"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { z } from "zod";
import {signInSchema} from "@/lib/auth/otp-code"


/************** useSignIn *****/
export function useSignIn(router: AppRouterInstance)
                {//useSignIn

                const onSubmit = useCallback(async (values: z.infer<typeof signInSchema>) =>
                      {

                      try {
                          toast.loading("Envoi d'un e-mail en cours...");

                          const response = await fetch("api/auth/send-code", {method: "POST", body: JSON.stringify(values),});

                            if(!response.ok)
                              {
                              const data = await response.json().catch(() => ({}));
                              toast.dismiss();
                              toast.error(data.error ?? "Erreur Inconue");

                              return;
                              }

                          toast.dismiss();
                          toast.success("Envoi réussi");

                          setTimeout(() => { router.push(`/verify-code?email=${encodeURIComponent(values.email)}`); }, 500);

                          }
                      catch (err:unknown)
                          {
                          toast.dismiss();

                          if(err instanceof Error) toast.error(err.message);
                          else                     toast.error("Erreur inconnue");

                          }
                     }, [router]);

                return { onSubmit };

                }//useSignIn
