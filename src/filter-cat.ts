/**
 * Filter class for constructing and managing filters on a page.
 *
 * @author Takuto Yanagida
 * @version 2024-01-26
 *
 * @remarks
 * This class provides functionality to construct and manage filters on a page.
 * Filters can be applied to lists based on user-selected criteria.
 * @public
 */

type KeyToVals = Map<string, ['or'|'and', string[], string, string]>;

export default class FilterCat {
	static #idx: number = 0;

	/**
	 * Constructs all filters on a page based on specified options.
	 *
	 * @param opts - Options for filter construction.
	 */
	static constructAll(opts = {} as {[k in string]: string|boolean}) {
		const selFilter = (typeof (opts['selFilter'] ?? null) === 'string') ? opts['selFilter'] as string : '.filter';
		const selList   = (typeof (opts['selList']   ?? null) === 'string') ? opts['selList']   as string : '.list';

		const fs = Array.from(document.querySelectorAll(`${selFilter}:not([for])`));
		const ls = Array.from(document.querySelectorAll(`${selList}:not([id])`));

		for (const f of fs) {
			const l = ls.shift();
			if (!l) break;

			const id = String(`fl${FilterCat.#idx++}`);
			f.setAttribute('for', String(id));
			l.setAttribute('id', String(id));

			new FilterCat(id, opts);
		}
	}

	/**
	 * Retrieves a non-empty value from the provided data map based on the given key.
	 *
	 * @private
	 * @param arr - Data map (dataset).
	 * @param key - Key to retrieve the value for.
	 * @returns Non-empty value or null if not found.
	 */
	static #nonEmpty(arr: DOMStringMap, key: string): string|null {
		const v = arr[key] ?? '';
		return v.length ? v : null;
	}


	// -------------------------------------------------------------------------


	#selFilter: string = '.filter';
	#selList  : string = '.list';

	#selFilterKey: string = '.filter-key';

	#selFilterSelect  : string =  '.filter-select';
	#selFilterEnabled : string =  '.filter-enabled';
	#selFilterRelation: string =  '.filter-relation';
	#selFilterValues  : string =  '.filter-values';

	#qvarBase  : string = '%key%';  // Base of query variable names ('%key%' is replaced by the key).
	#dsQvarBase: string = 'qvar-base';
	#dsQvar    : string = 'qvar';

	#classBase  : string = '%value%';  // Base of value class names ('%key%' and '%value%' are replaced by the key and the value).
	#dsClassBase: string = 'class-base';

	#dsKey  : string = 'key';    // For filters.
	#dsCount: string = 'count';  // For headings and lists
	#dsDepth: string = 'depth';  // For headings

	#doSetHeadingDepth   : boolean = true;
	#doInitializeByParams: boolean = true;

	#listElm: HTMLElement;
	#keyToUis: Map<string, [string, string, string, [HTMLInputElement, HTMLInputElement|null, HTMLInputElement[]|null]]> = new Map();
	#stopUpdate: boolean = false;

	/**
	 * Represents a filtering mechanism for manipulating lists based on user-defined criteria.
	 */
	constructor(id: string, opts = {} as {[k in string]: string|boolean}) {
		this.#assignOptions(opts);

		const f = document.querySelector(`${this.#selFilter}[for="${id}"]`) as HTMLElement;
		const l = document.querySelector(`${this.#selList}#${id}`);
		if (!f || !l) {
			throw new Error();
		}

		this.#listElm = l as HTMLElement;

		this.#initFilter(id, f);
		this.#initializeList();

		f.removeAttribute('hidden');
	}

	/**
	 * Assigns options to the Filter instance based on the provided options object.
	 *
	 * @private
	 * @param opts - Options object containing key-value pairs for configuration.
	 */
	#assignOptions(opts = {} as {[k in string]: string|boolean}) {
		if (typeof (opts['selFilter'] ?? null) === 'string') this.#selFilter = opts['selFilter'] as string;
		if (typeof (opts['selList']   ?? null) === 'string') this.#selList   = opts['selList']   as string;

		if (typeof (opts['selFilterKey'] ?? null) === 'string') this.#selFilterKey = opts['selFilterKey'] as string;

		if (typeof (opts['selFilterSelect']   ?? null) === 'string') this.#selFilterSelect   = opts['selFilterSelect']   as string;
		if (typeof (opts['selFilterEnabled']  ?? null) === 'string') this.#selFilterEnabled  = opts['selFilterEnabled']  as string;
		if (typeof (opts['selFilterRelation'] ?? null) === 'string') this.#selFilterRelation = opts['selFilterRelation'] as string;
		if (typeof (opts['selFilterValues']   ?? null) === 'string') this.#selFilterValues   = opts['selFilterValues']   as string;

		if (typeof (opts['qvarBase']   ?? null) === 'string') this.#qvarBase   = opts['qvarBase']   as string;
		if (typeof (opts['dsQvarBase'] ?? null) === 'string') this.#dsQvarBase = opts['dsQvarBase'] as string;
		if (typeof (opts['dsQvar']     ?? null) === 'string') this.#dsQvar     = opts['dsQvar']     as string;

		if (typeof (opts['classBase']   ?? null) === 'string') this.#classBase   = opts['classBase']   as string;
		if (typeof (opts['dsClassBase'] ?? null) === 'string') this.#dsClassBase = opts['dsClassBase'] as string;

		if (typeof (opts['dsKey']   ?? null) === 'string') this.#dsKey   = opts['dsKey']   as string;
		if (typeof (opts['dsCount'] ?? null) === 'string') this.#dsCount = opts['dsCount'] as string;
		if (typeof (opts['dsDepth'] ?? null) === 'string') this.#dsDepth = opts['dsDepth'] as string;

		if (typeof (opts['doSetHeadingDepth']    ?? null) === 'boolean') this.#doSetHeadingDepth    = opts['doSetHeadingDepth']    as boolean;
		if (typeof (opts['doInitializeByParams'] ?? null) === 'boolean') this.#doInitializeByParams = opts['doInitializeByParams'] as boolean;
	}


	// -------------------------------------------------------------------------


	/**
	 * Initializes the filter based on the provided ID and filter element.
	 *
	 * @private
	 * @param id - Filter ID.
	 * @param filterElm - Filter element.
	 */
	#initFilter(id: string, filterElm: HTMLElement): void {
		const fkElms = Array.from(filterElm.querySelectorAll(this.#selFilterKey)) as HTMLElement[];

		this.#assignAttributes(id, fkElms);

		const qvarBase = FilterCat.#nonEmpty(filterElm.dataset, this.#dsQvarBase) ?? this.#qvarBase;
		const rClsBase = FilterCat.#nonEmpty(filterElm.dataset, this.#dsClassBase) ?? this.#classBase;

		for (const e of fkElms) {
			const key  = e.dataset[this.#dsKey];
			if (!key) continue;
			const qvar = FilterCat.#nonEmpty(e.dataset, this.#dsQvar) ?? qvarBase.replace('%key%', key);
			const cls  = (FilterCat.#nonEmpty(e.dataset, this.#dsClassBase) ?? rClsBase).replace('%key%', key);

			const sel = e.querySelector(this.#selFilterSelect) as HTMLInputElement;
			if (sel) {
				this.#keyToUis.set(key, [cls, qvar, 'select', [sel, null, null]]);
			} else {
				const ena = e.querySelector(this.#selFilterEnabled) as HTMLInputElement;
				const rel = e.querySelector(this.#selFilterRelation) as HTMLInputElement;
				const cbs = Array.from(e.querySelectorAll(this.#selFilterValues + ' input')) as HTMLInputElement[];
				this.#keyToUis.set(key, [cls, qvar, 'checkbox', [ena, rel, cbs]]);
			}
		}
		for (const [_key, [_cls, _qvar, type, es]] of this.#keyToUis) {
			this.#assignEventListener(type, es);
		}
		if (this.#doInitializeByParams) {
			this.#stopUpdate = true;
			this.#getStateFromUrlParams();
			this.#stopUpdate = false;
		}
		this.#update();
	}

	/**
	 * Assigns UI element attributes based on the filter ID and key elements.
	 *
	 * @private
	 * @param id - Filter ID.
	 * @param fkElms - Filter key elements.
	 */
	#assignAttributes(id: string, fkElms: HTMLElement[]): void {
		for (const fk of fkElms) {
			const key = fk.dataset[this.#dsKey];
			if (!key) continue;
			setIdFor(fk, this.#selFilterEnabled, key, 'enabled', id);
			setIdFor(fk, this.#selFilterRelation, key, 'relation', id);

			const s = fk.querySelector(this.#selFilterSelect) as HTMLInputElement;
			if (s) s.name = `select-${key}`;
			const cbs = Array.from(fk.querySelectorAll(this.#selFilterValues + ' input')) as HTMLInputElement[];
			for (const cb of cbs) cb.name = `${key}-${cb.value}`;
		}

		function setIdFor(fk: HTMLElement, sel: string, key: string, prefix: string, suffix: string): void {
			const fe = fk.querySelector(sel);
			if (!fe) return;

			fe.id = `${prefix}-${key}-${suffix}`;

			let e = fe;
			while (e.nextElementSibling) {
				e = e.nextElementSibling;
				if (e.tagName !== 'LABEL') break;
				e.setAttribute('for', fe.id);
			}
		}
	}

	/**
	 * Updates the list based on the current filter criteria.
	 *
	 * @private
	 */
	#update(): void {
		if (this.#stopUpdate) {
			return;
		}
		const keyToVals = this.#getKeyToVals();

		this.#fixListHeight();
		this.#filterLists(keyToVals);
		this.#countUpItems();
		this.#freeListHeight();

		this.#setUrlParams(keyToVals);
	}


	// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


	/**
	 * Assigns event listeners to UI elements based on the UI type and elements.
	 *
	 * @private
	 * @param type - UI type (select or checkbox).
	 * @param es - UI elements.
	 */
	#assignEventListener(type: string, es: [HTMLInputElement, HTMLInputElement|null, HTMLInputElement[]|null]): void {
		if (type === 'select') {
			const [sel] = es;
			sel.addEventListener('change', () => this.#update());
		} else if (type === 'checkbox') {
			const [ena, rel, cbs] = es;
			if (ena && cbs) {
				ena.addEventListener('click', () => {
					if (ena.checked && !this.#isCheckedAtLeastOne(cbs)) {
						for (const cb of cbs) cb.checked = true;
					}
					if (!ena.checked && this.#isCheckedAll(cbs)) {
						for (const cb of cbs) cb.checked = false;
					}
					this.#update();
				});
				for (const cb of cbs) {
					cb.addEventListener('click', () => {
						ena.checked = this.#isCheckedAtLeastOne(cbs);
						this.#update();
					});
				}
			}
			if (rel) {
				rel.addEventListener('click', () => this.#update());
			}
		}
	}

	/**
	 * Checks if at least one checkbox is checked among the provided checkboxes.
	 *
	 * @private
	 * @param cbs - Checkboxes to check.
	 * @returns Whether any checkbox is checked
	 */
	#isCheckedAtLeastOne(cbs: HTMLInputElement[]): boolean {
		for (const cb of cbs) {
			if (cb.checked) return true;
		}
		return false;
	}

	/**
	 * Check if all checkboxes are checked.
	 *
	 * @private
	 * @param cbs - Checkboxes to check.
	 * @returns Whether all checkboxes are checked
	 */
	#isCheckedAll(cbs: HTMLInputElement[]): boolean {
		for (const cb of cbs) {
			if (!cb.checked) return false;
		}
		return true;
	}

	/**
	 * Gets the key-to-values mapping based on the current state of filters.
	 *
	 * @private
	 * @returns Key-to-values mapping representing the filter criteria.
	 */
	#getKeyToVals(): KeyToVals {
		const kvs = new Map();
		for (const [key, [cls, qvar, type, es]] of this.#keyToUis) {
			if (type === 'select') {
				const [sel] = es;
				if (sel && '' !== sel.value) {
					kvs.set(key, ['or', [sel.value], cls, qvar]);
				}
			} else if (type === 'checkbox') {
				const [ena, rel, cbs] = es;
				if (ena && rel && cbs && ena.checked) {
					const oa = (rel && rel.checked) ? 'and' : 'or';
					kvs.set(key, [oa, this.#getCheckedVals(cbs), cls, qvar]);
				}
			}
		}
		return kvs;
	}

	/**
	 * Gets the array of checked values from a group of checkboxes.
	 *
	 * @private
	 * @param cbs - Checkboxes to retrieve checked values from.
	 * @returns Array of checked values.
	 */
	#getCheckedVals(cbs: HTMLInputElement[]): string[] {
		const vs: string[] = [];
		for (const cb of cbs) {
			if (cb.checked) vs.push(cb.value);
		}
		return vs;
	}


	// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


	/**
	 * Gets the current state of filters from URL parameters and updates the filter accordingly.
	 *
	 * @private
	 */
	#getStateFromUrlParams(): void {
		const usp = new URLSearchParams(document.location.search);

		for (const [_key, [_cls, qvar, type, es]] of this.#keyToUis) {
			if (!usp.has(qvar)) {
				continue;
			}
			let v = usp.get(qvar) as string;
			let oa = 'or';
			if (v.startsWith('.')) {
				v = v.substring(1);
				oa = 'and';
			}
			if (type === 'select') {
				const [sel] = es;
				sel.value = v;
			} else if (type === 'checkbox') {
				const [ena, rel, cbs] = es;
				if (ena) ena.checked = true;
				if (rel) rel.checked = (oa === 'and');
				if (cbs) {
					const vs = new Set(v.split(',').map(e => e.trim()));
					for (const cb of cbs) {
						cb.checked = vs.has(cb.value);
					}
				}
			}
		}
	}

	/**
	 * Sets URL parameters based on the current state of filters.
	 *
	 * @private
	 * @param keyToVals - Mapping of filter keys to their values.
	 */
	#setUrlParams(keyToVals: KeyToVals): void {
		const rs = { or: '', and: '.' };
		const ps: string[] = [];
		for (const [_key, [oa, vs, _cls, qvar]] of keyToVals) {
			if (vs.length) {
				ps.push(`${qvar}=${rs[oa]}${vs.join(',')}`);
			}
		}
		let url;
		if (ps.length > 0) {
			url = '?' + ps.join('&');
		} else {
			url = document.location.origin + document.location.pathname;
		}
		history.replaceState('', '', url + document.location.hash);
	}


	// -------------------------------------------------------------------------


	/**
	 * Initializes the list by assigning depth values to heading elements.
	 *
	 * @private
	 */
	#initializeList() {
		const assignDepth = () => {
			for (const h of this.#listElm.children) {
				if (!(h instanceof HTMLHeadingElement)) continue;
				(h as HTMLElement).dataset[this.#dsDepth] = String(parseInt(h.tagName[1]) - 1);
			}
		}
		if (this.#doSetHeadingDepth) {
			assignDepth();
		}
	}


	// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


	/**
	 * Fixes the height of lists to prevent layout shifts.
	 *
	 * @private
	 */
	#fixListHeight() {
		for (const e of this.#listElm.children) {
			if (!(e instanceof HTMLElement)) continue;
			if (e.tagName !== 'OL' && e.tagName !== 'UL') continue;

			const h = e.offsetHeight;
			e.setAttribute('style', `--height:${h}px;`);
		}
	}

	/**
	 * Frees the height of lists after filtering is complete.
	 *
	 * @private
	 */
	#freeListHeight() {
		for (const e of this.#listElm.children) {
			if (!(e instanceof HTMLElement)) continue;
			if (e.tagName !== 'OL' && e.tagName !== 'UL') continue;

			e.removeAttribute('style');
		}
	}


	// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


	/**
	 * Filter lists based on the provided key-value mapping.
	 *
	 * @private
	 * @param keyToVals - Mapping of filter keys to their values
	 */
	#filterLists(keyToVals: KeyToVals): void {
		for (const e of this.#listElm.children) {
			if (!(e instanceof HTMLElement)) continue;
			if (e.tagName !== 'OL' && e.tagName !== 'UL') continue;

			let count = 0;
			for (const li of e.children) {
				if (li.tagName !== 'LI') continue;

				if (this.#isMatch(li, keyToVals)) {
					count += 1;
					li.removeAttribute('hidden');
				} else {
					li.setAttribute('hidden', '');
				}
			}
			e.dataset[this.#dsCount] = String(count);
		}
	}

	/**
	 * Checks if a list item matches the provided filter values.
	 *
	 * @private
	 * @param li - List item element.
	 * @param keyToVals - Mapping of filter keys to their values.
	 * @returns Whether the list item matches the filter values.
	 */
	#isMatch(li: Element, keyToVals: KeyToVals): boolean {
		for (const [_key, [oa, vs, cls]] of keyToVals) {
			if (!this.#isMatchOne(li, vs, cls, 'or' === oa)) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Checks if a list item matches a single filter value.
	 *
	 * @private
	 * @param li - List item element.
	 * @param vs - Filter values.
	 * @param cls - Class name pattern.
	 * @param isOr - Whether it's an 'or' operation.
	 * @returns Whether the list item matches the filter value.
	 */
	#isMatchOne(li: Element, vs: string[], cls: string, isOr: boolean): boolean {
		if (isOr) {
			for (const v of vs) {
				const c = cls.replace('%value%', v).replace('_', '-');
				if (li.classList.contains(c)) {
					return true;
				}
			}
			return false;
		} else {
			for (const v of vs) {
				const c = cls.replace('%value%', v).replace('_', '-');
				if (!li.classList.contains(c)) {
					return false;
				}
			}
			return true;
		}
	}


	// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


	/**
	 * Counts up the number of items under each heading and updates their visibility.
	 *
	 * @private
	 */
	#countUpItems(): void {
		for (const e of this.#listElm.children) {
			if (!(e instanceof HTMLElement)) continue;

			if (e.dataset[this.#dsDepth]) e.dataset[this.#dsCount] = '0';  // 'e' is heading
		}
		const hs: HTMLElement[] = [];
		for (const e of this.#listElm.children) {
			if (!(e instanceof HTMLElement)) continue;

			if (e.dataset[this.#dsDepth]) {  // 'e' is heading
				const hi = parseInt(e.dataset[this.#dsDepth] ?? '');
				while (hs.length > 0) {
					const l = hs[hs.length - 1];
					if (hi > parseInt(l.dataset[this.#dsDepth] ?? '')) break;
					hs.length -= 1;
				}
				hs.push(e);
			} else {  // 'e' is list
				const count = parseInt(e.dataset[this.#dsCount] ?? '');
				for (const h of hs) {
					const sum = parseInt(h.dataset[this.#dsCount] ?? '') + count;
					h.dataset[this.#dsCount] = String(sum);
					if (sum) {
						h.removeAttribute('hidden');
					} else {
						h.setAttribute('hidden', '');
					}
				}
			}
		}
	}
}
