import Link from "next/link";

export default function LegalAcknowledgement() {
  return (
    <p className="text-xs leading-6 text-gray-500">
      By continuing, you acknowledge that you have read the{" "}
      <Link href="/legal/privacy" className="text-[#00ff66] underline-offset-4 hover:underline">
        Privacy Notice
      </Link>{" "}
      and agree to the{" "}
      <Link href="/legal/terms" className="text-[#00ff66] underline-offset-4 hover:underline">
        Website Terms of Use
      </Link>
      .
    </p>
  );
}
