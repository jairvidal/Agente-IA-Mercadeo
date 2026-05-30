/**
 * Categories the intent classifier can output.
 *
 * - `commercial_faq`: store/hours/product/service info question.
 * - `commercial_quotation`: quote request (product + quantity + location + contact).
 * - `non_commercial`: claim, supplier, accounting, HR, scrap → derive to human area.
 * - `not_understood`: ambiguous or out-of-domain message; triggers clarification flow.
 */
export type Category =
	| "commercial_faq"
	| "commercial_quotation"
	| "non_commercial"
	| "not_understood";

export const CATEGORIES: readonly Category[] = [
	"commercial_faq",
	"commercial_quotation",
	"non_commercial",
	"not_understood",
];

export interface Classification {
	category: Category;
	confidence: number;
	reasoning: string;
}
