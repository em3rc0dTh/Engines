import type {
  AppointmentProduct,
  AppointmentService,
  AppointmentSlot,
  RegisterNewAppointmentStartEnvelope,
} from '../../../contracts/register-new-appointment/index.js';
import type { CustomerDraft } from '../../../contracts/register-new-customer/index.js';
import type {
  AppointmentRecord,
  BookAppointmentInput,
  BookAppointmentResult,
  ReserveAppointmentCommandResult,
  ResolveAppointmentCustomerResult,
} from '../../../persistence/postgres/appointment.repository.js';

export type AppointmentActivities = Readonly<{
  reserveAppointmentCommand(input: Readonly<{
    start: RegisterNewAppointmentStartEnvelope;
    workflowId: string;
  }>): Promise<ReserveAppointmentCommandResult>;

  resolveAppointmentCustomer(input: Readonly<{
    businessSlug: string;
    customerId?: string;
    customer?: CustomerDraft;
  }>): Promise<ResolveAppointmentCustomerResult>;

  listAppointmentServices(input: Readonly<{ businessSlug: string }>): Promise<readonly AppointmentService[]>;

  listAppointmentProducts(input: Readonly<{
    businessSlug: string;
    serviceId: string;
  }>): Promise<readonly AppointmentProduct[]>;

  listAppointmentSlots(input: Readonly<{
    businessSlug: string;
    productId: string;
    appointmentDate: string;
  }>): Promise<readonly AppointmentSlot[]>;

  bookAppointment(input: BookAppointmentInput): Promise<BookAppointmentResult>;

  getAppointment(input: Readonly<{ appointmentId: string }>): Promise<AppointmentRecord | undefined>;
}>;
