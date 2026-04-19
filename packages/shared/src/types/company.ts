export type CompanyPlan = 'free' | 'pro' | 'enterprise';

export interface Company {
  id: string;
  name: string;
  plan: CompanyPlan;
  budget: number;
  spent: number;
  createdAt: Date;
}

export interface CreateCompanyInput {
  name: string;
  plan?: CompanyPlan;
  budget?: number;
}
