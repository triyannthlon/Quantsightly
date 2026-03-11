"use client";

import {AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

/************** ConfirmLogOutForm *****/
export function ConfirmLogOutForm({onConfirmAction,}: { onConfirmAction: () => void; })
       {//ConfirmLogOutForm

       return (
              <AlertDialog>
               <AlertDialogTrigger asChild>
                <Button
                          variant="destructive"
                             size="sm"
                        className="flex items-center gap-2">
                <LogOut className="w-4 h-4" />Se déconnecter
               </Button>
              </AlertDialogTrigger>

              <AlertDialogContent>
               <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la déconnexion</AlertDialogTitle>
                 <AlertDialogDescription>
                  Cette action mettra fin à votre session active sur cet appareil. Vous devrez vous reconnecter pour continuer.
                 </AlertDialogDescription>
                </AlertDialogHeader>

               <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                 <AlertDialogAction onClick={onConfirmAction}>Confirmer</AlertDialogAction>
               </AlertDialogFooter>
              </AlertDialogContent>
           </AlertDialog>
           );

       }//ConfirmLogOutForm

