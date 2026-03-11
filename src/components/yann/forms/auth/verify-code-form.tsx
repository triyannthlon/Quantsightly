"use client";

import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import {Card, CardHeader, CardContent,CardDescription,} from "@/components/ui/card";
import { Form, FormField, FormItem, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Logo from "@/components/yann/ui/logo";

import { verifycodeSchema } from "@/lib/auth/otp-code";

import { useVerifyCode } from "@/hooks/auth/verify-code/useVerifyCode"


/********************** VerifyCodeForm *****/
export default function VerifyCodeForm()
                        {//VerifyCodeForm

                                const params = useSearchParams();
                        const email = params.get("email");

                        const form = useForm<z.infer<typeof verifycodeSchema>>({resolver     : zodResolver(verifycodeSchema),
                                                                                defaultValues: { code: "" },});

                        const {inputsRef,timer,isResending,onSubmit,resendCode,} = useVerifyCode(email,form); /* appel de useVerifyCode dans hooks */

                        return (
                               <Card className="w-full max-w-sm sm:max-w-md md:max-w-lg border-0 shadow-none px-2 sm:px-0">
                                <CardHeader className="space-y-2">
                                 <div className="flex items-center justify-center sm:justify-center h-16"><Logo /></div>
                                <CardDescription className="text-xl sm:text-2xl font-semibold text-foreground text-center sm:text-center">Vérification du code</CardDescription>
                                </CardHeader>

                                <CardContent>
                                 <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 text-center sm:text-center">Un code a été envoyé à <strong>{email}</strong>.</p>

                                 <Form {...form}>
                                     <form onSubmit={form.handleSubmit(({ code }) => onSubmit(code))} className="space-y-6">
                                     <FormField
                                     control={form.control}
                                        name="code"
                                      render={({ field }) => (
                                                             <FormItem>
                                                              <FormControl>
                                                               <div className="flex justify-center gap-1 sm:gap-2">
                                                                {Array.from({ length: 6 }).map((_, i) => (
                                                                 <Input          key={i}
                                                                                type="text"
                                                                           inputMode="numeric"
                                                                        autoComplete="one-time-code"
                                                                           maxLength={1}
                                                                           className="w-10 h-10 sm:w-12 sm:h-12 text-center text-lg sm:text-xl"
                                                                                 ref={(el) => {inputsRef.current[i] = el;}}
                                                                            onChange={(e) => { const   value = e.target.value.replace(/\D/g, "");
                                                                                               const newCode = field.value.substring(0, i) + value + field.value.substring(i + 1);

                                                                                               field.onChange(newCode);

                                                                                               if (value && i < 5) { inputsRef.current[i + 1]?.focus();}
                                                                                             }
                                                                                  }/>))
                                                                }
                                                               </div>
                                                              </FormControl>
                                                             </FormItem>)}
                                   />
                                  </form>
                                 </Form>

                                 <div className="text-center mt-6">
                                  <div className="h-6 flex items-center justify-center">
                                   {timer > 0 ? (<p className="text-sm text-muted-foreground">Renvoyer le code dans <strong>{timer}s</strong></p>)
                                              : (<Button   variant="link"
                                                           onClick={resendCode}
                                                          disabled={isResending}
                                                         className="text-sm p-0"> {isResending ? "Envoi..." : "Renvoyer le code"}
                                                 </Button>)}
                                  </div>
                                 </div>
                                </CardContent>
                               </Card>
                               );

                        }//VerifyCodeForm
