import nodemailer from "nodemailer";
import {otpTemplate} from "@/lib/auth/otp-code";

/******************** SendEmail *****/
export async function SendEmail({To,Code}: {To: string; Code: string;})
                      {//SendEmail

                      const transporter = nodemailer.createTransport({  host: process.env.SMTP_HOST,
                                                                        port: Number(process.env.SMTP_PORT),
                                                                      secure: false,
                                                                        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS,},
                                                                      });

                      const mailOptions = {   from: process.env.FROM_EMAIL,
                                                to: To,
                                           subject: "Votre code de connexion",
                                              text: `Votre code de connexion est ${Code}`,
                                              html: otpTemplate({To,Code}),}


                      await transporter.sendMail(mailOptions);

                      }//SendEmail



