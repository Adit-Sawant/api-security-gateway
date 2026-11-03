import type {
  SubscriptionPlan,
} from '../../common/enums/subscription-plan.enum';

export interface UserEntity {
  id: string;
  name: string
  email: string;
  passwordHash: string;
  isActive: boolean;
  subscriptionPlan: SubscriptionPlan;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
}
