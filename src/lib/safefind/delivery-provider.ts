/**
 * Delivery provider abstraction - no hard dependency on a specific courier vendor.
 */

export type DeliveryProviderId = "internal" | string;

export type DeliveryAssignInput = {
  deliveryId: string;
  pickupPartnerId: string;
  destinationCommune: string | null;
  destinationQuartier: string | null;
};

export type DeliveryAssignResult = {
  accepted: boolean;
  externalRef?: string | null;
  message?: string;
};

export interface DeliveryProvider {
  id: DeliveryProviderId;
  assign(input: DeliveryAssignInput): Promise<DeliveryAssignResult>;
}

/** Default internal stub - admin/ops assigns courier manually. */
export class InternalDeliveryProvider implements DeliveryProvider {
  id: DeliveryProviderId = "internal";
  async assign(_input: DeliveryAssignInput): Promise<DeliveryAssignResult> {
    return { accepted: true, externalRef: null, message: "internal_manual_assign" };
  }
}

let _provider: DeliveryProvider | null = null;

export function getDeliveryProvider(): DeliveryProvider {
  if (!_provider) _provider = new InternalDeliveryProvider();
  return _provider;
}

export function setDeliveryProvider(p: DeliveryProvider) {
  _provider = p;
}
