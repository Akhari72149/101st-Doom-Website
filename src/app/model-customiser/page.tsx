import type { Metadata } from "next";
import ModelCustomiserLoader from "@/components/model-customiser/ModelCustomiserLoader";

export const metadata: Metadata = {
  title: "Model Customiser | 101st Doom Battalion",
  description: "Create controlled armour and vehicle customisation references with approved paint and insignia.",
};

export default function ModelCustomiserPage() {
  return <ModelCustomiserLoader />;
}
