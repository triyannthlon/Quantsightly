'use client';

import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {Form, FormControl, FormField, FormItem, FormLabel,} from "@/components/ui/form";
import {Card, CardHeader, CardDescription, CardContent,} from "@/components/ui/card";
import Logo from "@/components/custom/ui/logo";
import {useSignIn} from "@/hooks/auth/sign-in/useSignIn";
import {signInSchema} from "@/lib/auth/otp-code"


/********************** SignInForm *****/
export default function SignInForm()
                        {//SignInForm


                        const router = useRouter();

                        const { onSubmit } = useSignIn(router);

                        const form = useForm<z.infer<typeof signInSchema>>({resolver: zodResolver(signInSchema),defaultValues: { email: "" },});

                        return (
                               <Card className="w-full max-w-sm sm:max-w-md md:max-w-lg border-0 shadow-none px-2 sm:px-0">
                                <CardHeader className="space-y-2">
                                 <div className="flex items-center justify-center sm:justify-center h-16"><Logo /></div>
                                  <CardDescription className= "text-xl sm:text-2xl font-semibold text-foreground text-center sm:text-center" >Bienvenue</CardDescription>
                                </CardHeader>
                                <CardContent>
                                 <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 text-center sm:text-center">
                                  Veuillez saisir votre adresse e‑mail afin de recevoir votre code de vérification à six chiffres.<br />
                                  <em className="text-xs sm:text-sm">(N’oubliez pas de vérifier votre dossier de spams.)</em>
                                 </p>

                                 <Form {...form}>
                                     <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                     <FormField
                                     control={form.control}
                                        name="email"
                                      render={({ field }) => (
                                                             <FormItem>
                                                              <FormLabel className="text-sm sm:text-base text-foreground font-semibold">Email</FormLabel>
                                                              <FormControl>
                                                               <Input className="w-full h-10 sm:h-12 text-sm sm:text-base" placeholder="ton.email@example.com" type="email" autoComplete="email" {...field} />
                                                              </FormControl>
                                                             </FormItem>)}
                                   />
                                   <Button type="submit" className="w-full justify-center h-10 sm:h-12 text-sm sm:text-base">Envoyer le code</Button>
                                  </form>
                                 </Form>
                                </CardContent>
                               </Card>
                               );

                        }//SignInForm



