/**
 * WealthIQ — Household Spending Benchmark Types and Client Helpers
 * Phase 17: HCES 2023-24 ML Regression Integration
 */

export type SectorType = 'rural' | 'urban';
export type EducationTier = 'below_primary' | 'primary_middle' | 'secondary_higher' | 'graduate_above';
export type LivelihoodType = 'regular_wage' | 'self_employed' | 'casual_labour' | 'other';
export type DwellingType = 'pucca' | 'semi_pucca' | 'katcha';
export type CookingFuelType = 'lpg' | 'png_electric' | 'firewood' | 'other';
export type LandOwnershipType = 'owned' | 'not_owned';

export interface StateOption {
  code: string;
  name: string;
}

export const INDIAN_STATES: StateOption[] = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu and Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Ladakh' },
];

export const EDUCATION_OPTIONS = [
  { value: 'graduate_above', label: 'Graduate & Above (Degree / Professional / Postgrad)' },
  { value: 'secondary_higher', label: 'Secondary / Higher Secondary / Diploma (Class 9–12)' },
  { value: 'primary_middle', label: 'Primary / Middle (Class 1–8)' },
  { value: 'below_primary', label: 'Below Primary or Literate without formal schooling' },
] as const;

export const LIVELIHOOD_OPTIONS = [
  { value: 'regular_wage', label: 'Regular Wage / Salaried Employment' },
  { value: 'self_employed', label: 'Self-Employed (Business, Trade, Agriculture)' },
  { value: 'casual_labour', label: 'Casual Labour' },
  { value: 'other', label: 'Other (Pension, Remittances, Investments)' },
] as const;

export const DWELLING_OPTIONS = [
  { value: 'pucca', label: 'Pucca (Solid brick, stone, concrete, permanent structure)' },
  { value: 'semi_pucca', label: 'Semi-Pucca (Solid walls with non-permanent roof or vice-versa)' },
  { value: 'katcha', label: 'Katcha (Clay, mud, thatch, temporary materials)' },
] as const;

export const COOKING_FUEL_OPTIONS = [
  { value: 'png_electric', label: 'Piped Natural Gas (PNG) / Electricity / Induction' },
  { value: 'lpg', label: 'LPG Cylinder' },
  { value: 'firewood', label: 'Firewood / Biomass / Dung Cakes' },
  { value: 'other', label: 'Kerosene / Biogas / Other' },
] as const;

export const LAND_OWNERSHIP_OPTIONS = [
  { value: 'owned', label: 'Land Owned' },
  { value: 'not_owned', label: 'No Land Owned' },
] as const;

export interface HouseholdBenchmarkInput {
  state: string;
  sector: SectorType;
  highest_education: EducationTier;
  livelihood: LivelihoodType;
  dwelling_type: DwellingType;
  cooking_fuel: CookingFuelType;
  land_owned: LandOwnershipType;
  hh_size: number;
  num_adults: number;
  num_children: number;
}

export interface HouseholdBenchmarkResult {
  success: boolean;
  estimated_mpce: number;
  estimated_household_total: number;
  state_code: string;
  state_name: string;
  sector: SectorType;
  household_size: number;
  num_adults: number;
  num_children: number;
  reference_benchmarks: {
    state_sector_median_mpce: number | null;
    state_sector_mean_mpce: number | null;
    state_sector_p25_mpce: number | null;
    state_sector_p75_mpce: number | null;
    sample_size: number | null;
  };
  uncertainty: {
    segment_mae: number;
    segment_rmse: number;
    segment_r2: number;
    typical_range_mpce: [number, number];
    typical_range_household: [number, number];
    note: string;
  };
  model_metadata: {
    model_name: string;
    algorithm: string;
    version: string;
    survey: string;
    survey_period: string;
    total_survey_households: number;
  };
}

export async function requestHouseholdBenchmark(
  input: HouseholdBenchmarkInput,
  authToken?: string
): Promise<HouseholdBenchmarkResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch('/api/household-benchmark', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Benchmark request failed with status ${response.status}`);
  }

  return data as HouseholdBenchmarkResult;
}
