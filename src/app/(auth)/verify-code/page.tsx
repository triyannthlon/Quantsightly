import { Suspense } from "react";
import VerifyCodeForm from "@/components/custom/forms/auth/verify-code-form";

/********************** VerifyCodePage *****/
export default function VerifyCodePage() {
  // VerifyCodeForm lit useSearchParams() → doit être sous un boundary Suspense
  // (sinon Next 16 échoue au prerender, cf. missing-suspense-with-csr-bailout).
  return (
    <Suspense>
      <VerifyCodeForm />
    </Suspense>
  );
}
