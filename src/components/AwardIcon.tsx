import type { CSSProperties } from "react";
import { Paperclip } from "lucide-react";
import {
  GiArmorVest,
  GiCheckedShield,
  GiCrossedSwords,
  GiCrystalGrowth,
  GiHeartBeats,
  GiJetFighter,
  GiLaurelCrown,
  GiLifeSupport,
  GiLungs,
  GiMedal,
  GiMedicalPack,
  GiMedicines,
  GiRibbonMedal,
  GiShieldBounces,
  GiStarfighter,
  GiStarsStack,
  GiTank,
  GiTrophy,
} from "react-icons/gi";

export function AwardIcon({ iconKey, className = "h-5 w-5", style }: {
  iconKey?: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  if (iconKey === "swords") return <GiCrossedSwords className={className} style={style} />;
  if (iconKey === "medical") return <GiMedicalPack className={className} style={style} />;
  if (iconKey === "shield") return <GiCheckedShield className={className} style={style} />;
  if (iconKey === "star") return <GiStarsStack className={className} style={style} />;
  if (iconKey === "engineering") return <GiCrystalGrowth className={className} style={style} />;
  if (iconKey === "ribbon") return <GiRibbonMedal className={className} style={style} />;
  if (iconKey === "laurel") return <GiLaurelCrown className={className} style={style} />;
  if (iconKey === "trophy") return <GiTrophy className={className} style={style} />;
  if (iconKey === "armor") return <GiArmorVest className={className} style={style} />;
  if (iconKey === "shield_burst") return <GiShieldBounces className={className} style={style} />;
  if (iconKey === "tank") return <GiTank className={className} style={style} />;
  if (iconKey === "jet") return <GiJetFighter className={className} style={style} />;
  if (iconKey === "starfighter") return <GiStarfighter className={className} style={style} />;
  if (iconKey === "heart") return <GiHeartBeats className={className} style={style} />;
  if (iconKey === "plasma") return <GiMedicines className={className} style={style} />;
  if (iconKey === "surgery") return <GiLifeSupport className={className} style={style} />;
  if (iconKey === "lungs") return <GiLungs className={className} style={style} />;
  if (iconKey === "paperclip") return <Paperclip className={className} style={style} />;
  return <GiMedal className={className} style={style} />;
}
