import { describe, it, expect } from 'vitest';
import { extractComponentTrail, discoverRoutesAndPages } from '../trailExtractor';

describe('trailExtractor', () => {
  const allFilePaths = [
    'src/components/CheckoutButton.tsx',
    'src/stores/cartStore.ts',
    'src/api/orderClient.ts',
    'src/types/order.ts',
    'src/pages/checkout.tsx',
  ];

  const fileMap = new Map<string, string>([
    [
      'src/components/CheckoutButton.tsx',
      `
import React from 'react';
import { useCartStore } from '../stores/cartStore';
import { OrderPayload } from '../types/order';

export const CheckoutButton = () => {
  const checkout = useCartStore((state) => state.checkout);
  const handleClick = async () => {
    await checkout();
  };
  return <button onClick={handleClick}>Finalizar Compra</button>;
};
`
    ],
    [
      'src/stores/cartStore.ts',
      `
import { create } from 'zustand';
import { submitOrder } from '../api/orderClient';
import { OrderPayload } from '../types/order';

export const useCartStore = create((set, get) => ({
  items: [],
  checkout: async () => {
    const res = await submitOrder({ items: get().items });
    return res;
  }
}));
`
    ],
    [
      'src/api/orderClient.ts',
      `
import { OrderPayload } from '../types/order';

export const submitOrder = async (payload: OrderPayload) => {
  const res = await fetch('/api/orders/checkout', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res.json();
};
`
    ],
    [
      'src/types/order.ts',
      `
export interface OrderPayload {
  items: string[];
  total?: number;
}
`
    ],
    [
      'src/pages/checkout.tsx',
      `
import React from 'react';
import { CheckoutButton } from '../components/CheckoutButton';

export const CheckoutPage = () => {
  return (
    <div>
      <h1>Checkout</h1>
      <CheckoutButton />
    </div>
  );
};
`
    ]
  ]);

  it('should extract top-down execution trail from UI Component to Store, API, and Types', () => {
    const trail = extractComponentTrail({
      targetPath: 'src/components/CheckoutButton.tsx',
      allFilePaths,
      fileMap,
    });

    expect(trail.rootName).toBe('CheckoutButton.tsx');
    expect(trail.nodes.length).toBeGreaterThanOrEqual(4);

    // Verify stages
    const uiNode = trail.nodes.find((n) => n.stage === 'ui');
    const stateNode = trail.nodes.find((n) => n.stage === 'state');
    const apiNode = trail.nodes.find((n) => n.stage === 'network');
    const typeNode = trail.nodes.find((n) => n.stage === 'type');

    expect(uiNode).toBeDefined();
    expect(uiNode?.path).toBe('src/components/CheckoutButton.tsx');

    expect(stateNode).toBeDefined();
    expect(stateNode?.path).toBe('src/stores/cartStore.ts');
    expect(stateNode?.type).toBe('store');

    expect(apiNode).toBeDefined();
    expect(apiNode?.stage).toBe('network');

    expect(typeNode).toBeDefined();
    expect(typeNode?.path).toBe('src/types/order.ts');

    // Verify links
    expect(trail.links.length).toBeGreaterThanOrEqual(3);
    const hasUiToStateLink = trail.links.some((l) => l.kind === 'state');
    expect(hasUiToStateLink).toBe(true);
  });

  it('should discover routes and pages with nested components', () => {
    const routes = discoverRoutesAndPages(allFilePaths, fileMap);
    expect(routes.length).toBeGreaterThanOrEqual(1);

    const checkoutPage = routes.find((r) => r.path === 'src/pages/checkout.tsx');
    expect(checkoutPage).toBeDefined();
    expect(checkoutPage?.route).toBe('/checkout');
    expect(checkoutPage?.components.length).toBeGreaterThanOrEqual(1);
    expect(checkoutPage?.components[0].name).toBe('CheckoutButton');
  });
});
