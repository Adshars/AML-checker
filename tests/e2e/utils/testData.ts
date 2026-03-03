import { faker } from '@faker-js/faker';

/** Unique email safe for repeated test runs — no cleanup needed */
export function uniqueEmail(prefix = 'test'): string {
  // toLowerCase: emails are case-insensitive; backends canonicalize to lowercase,
  // so comparisons against backend responses (e.g. in success alerts) would fail otherwise.
  return `${prefix}.${faker.string.alphanumeric(8).toLowerCase()}.${Date.now()}@test-e2e.com`;
}

export function strongPassword(): string {
  return `Pw${faker.string.alphanumeric(10)}1!`;
}

export function orgPayload(email?: string) {
  return {
    orgName: `${faker.company.name()} ${Date.now()}`,
    country: 'PL',
    city: faker.location.city(),
    address: faker.location.streetAddress(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: email ?? uniqueEmail('org'),
    password: strongPassword(),
  };
}

export function userPayload(email?: string) {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: email ?? uniqueEmail('user'),
    password: strongPassword(),
  };
}
