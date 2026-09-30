window.__ModuleLoader__.load({
	id: "dsh-sym",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");

		//#region styles
		/**
		* `react-dom`, for the portalled cost panel. Absence is survivable: the panel
		* degrades to the hover tooltip that was already there.
		*/
		let ReactDOM = null;
		try {
			ReactDOM = require("react-dom");
		} catch {
			ReactDOM = null;
		}


		/**
		* The two cost cells deliberately share `dsh-client-ui-chat`'s StatsPills row
		* type scale; the balance cell borrows the sidebar foot's own rhythm.
		*
		* The trailing rules are the one place this plugin touches shipped layout:
		* the sidebar foot stacks `sidebar.footer.action` above `sidebar.settings`,
		* and the account row has no additive seat beside it. Reordering the foot
		* into a row puts the balance immediately after the account name instead —
		* and `:has()` keeps every one of those rules inert until the balance cell is
		* actually rendered, so a collapsed rail, a signed-out client or a removed
		* plugin leaves the shipped layout byte-for-byte alone.
		*/
		const CSS = ".dshSym_root{box-sizing:border-box;min-width:0;max-width:100%;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));gap:12px;display:flex}.dshSym_pill{box-sizing:border-box;corner-shape:round;max-width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;background:0 0;border:none;border-radius:999px;align-items:center;gap:6px;padding:1px 8px;display:inline-flex;cursor:default}.dshSym_pill svg{flex:none;width:14px;height:14px}.dshSym_label{text-overflow:ellipsis;min-width:0;overflow:hidden}.dshBalance_root{box-sizing:border-box;max-width:100%;color:var(--dsw-alias-label-tertiary);font-size:12px;font-variant-numeric:tabular-nums;line-height:16px;white-space:nowrap;background:0 0;border:none;border-radius:8px;align-items:center;gap:4px;padding:3px 8px;display:inline-flex;cursor:pointer}.dshBalance_root svg{flex:none;width:13px;height:13px}.dshBalance_root:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.dshBalance_root:focus-visible{outline:var(--dsh-focus-ring-width) solid var(--dsh-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.dshBalance_value{font-variant-numeric:tabular-nums}.dshSym_panelWrap{position:relative;display:inline-flex}.dshSym_panel{position:fixed;z-index:2147483000;box-sizing:border-box;min-width:280px;max-width:min(380px,92vw);background:var(--dsw-alias-bg-elevated,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-secondary,var(--dsw-alias-separator-primary));border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.32);padding:10px 12px;font-size:12px;line-height:18px;text-align:left}.dshSym_panelTitle{display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:600}.dshSym_panelRule{height:1px;background:var(--dsw-alias-separator-primary);margin:8px 0}.dshSym_panelRow{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-variant-numeric:tabular-nums}.dshSym_panelRow>span:last-child{white-space:nowrap}.dshSym_panelMuted{color:var(--dsw-alias-label-tertiary)}.dshSym_panelHeading{color:var(--dsw-alias-label-tertiary);margin:8px 0 2px;font-size:11px}.dshSym_panelSave{color:var(--dsw-alias-state-business-primary,var(--dsw-alias-label-secondary))}[class*=\"_footArea\"]:has([data-account-balance]){flex-direction:row;align-items:center;gap:2px}[class*=\"_footArea\"]:has([data-account-balance])>[class*=\"_footerActions\"]{order:2;width:auto;flex:none;justify-content:flex-end;padding-inline-end:4px}[class*=\"_footArea\"]:has([data-account-balance])>[class*=\"_settingsArea\"]{order:1;width:auto;flex:1 1 auto;min-width:0}.dshQuoteAction{box-sizing:border-box;color:var(--dsw-alias-label-tertiary);font:inherit;font-weight:500;background:0 0;border:none;border-radius:999px;place-items:center;width:28px;height:28px;padding:0;display:grid;cursor:pointer}.dshQuoteAction:disabled{cursor:default;opacity:.45}.dshQuoteAction:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.dshQuoteAction:focus-visible{outline:var(--dsh-focus-ring-width) solid var(--dsh-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.dshQuoteMark{font-size:15px;line-height:1}.dshQuoteFlag{font-size:10px;line-height:1;color:var(--dsw-alias-label-caption,inherit)}.dshSymTurnCost{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-tertiary);font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(24px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));font-variant-numeric:tabular-nums;white-space:nowrap;order:1}.dshSymTurnCost svg{flex:none;width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px))}[class*=\"_endInfo\"]{order:2}.dshBrandRow{display:flex;align-items:center;gap:6px;min-width:0}.dshPeakTag{box-sizing:border-box;font-size:10px;font-weight:500;line-height:14px;white-space:nowrap;border:.5px solid transparent;border-radius:5px;padding:0 5px;cursor:default}.dshPeakOn{color:var(--dsw-alias-state-warn-primary,var(--dsw-alias-label-secondary));border-color:currentColor}[class*=\"_brandIdentity\"]::after{content:var(--dsh-peak-label,\"\");font-size:10px;font-weight:500;line-height:14px;white-space:nowrap;border:.5px solid currentColor;border-radius:5px;padding:0 5px;margin-inline-start:6px;align-self:center}html[data-dsh-peak=\"peak\"] [class*=\"_brandIdentity\"]::after{color:var(--dsw-alias-state-warn-primary,var(--dsw-alias-label-secondary))}html[data-dsh-peak=\"off\"] [class*=\"_brandIdentity\"]::after{color:var(--dsw-alias-label-tertiary)}";
		const CSS_TAG = "dsh-sym/CostPill.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-sym";
			tag.dataset.pluginCss = CSS_TAG;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region locale
		const NS = "dsh-sym";
		/** Simplified Chinese dictionary and key-set source of truth. */
		const zh = {
			"amount": "¥{amount}",
			"totalTitle": "本会话总费用 {amount} 元",
			"taskTitle": "本次任务（第 {turn} 轮）费用 {amount} 元",
			"billed": "计费请求 {count} 次",
			"peak": "高峰 {count} 次",
			"allOffPeak": "全部空闲时段",
			"tierPeak": "高峰价 ×{mult}",
			"tierOffPeak": "空闲价 ×{mult}",
			"tierFlat": "单一价（该厂商不分时段）",
			"times": "{count} 次",
			"unit": "单价（元/百万）：命中 {hit} · 未命中 {miss} · 输出 {out}",
			"unitRaw": "价目原始值 $ {hit} / {miss} / {out} 每百万 · 按 1 USD = {fx} CNY 折算",
			"cacheHit": "缓存命中输入",
			"cacheMiss": "缓存未命中输入",
			"output": "输出",
			"cacheWrite": "缓存写入",
			"cacheFree": "官方不收缓存写入费",
			"subtotal": "小计 ¥{amount}",
			"notPriced": "未收录价目，未计入金额",
			"unpricedNote": "未计价模型：{models}",
			"cacheSaved": "缓存为你省下 ¥{amount}",
			"offPeakSaved": "谷时为你省下 ¥{amount}",
			"wouldHaveCost": "本来要花",
			"actualCost": "实际支出",
			"savedTotal": "一共省下",
			"panelTitle": "会话花费",
			"panelHint": "点一下收起",
			"tokensHeading": "Token 用量",
			"breakdownHeading": "花费明细",
			"offPeakOnly": "仅高峰/空闲定价的模型参与谷时折扣",
			"cacheSavedLabel": "缓存为你省下",
			"offPeakSavedLabel": "谷时为你省下",
			"cacheHitLabel": "缓存命中 {percent}",
			"cacheMissLabel": "未缓存输入",
			"outputLabel": "输出",
			"taskLabel": "本次任务（第 {turn} 轮）",
			"amountLabel": "花费",
			"cacheSavedHint": "这些 token 若未命中缓存，会按未命中价计费",
			"unknownVendor": "未知厂商",
			"balanceTitle": "DeepSeek 账户余额（点击刷新）",
			"balanceCash": "充值余额",
			"balanceBonus": "赠送余额",
			"balanceUpdated": "更新于 {time}",
			"balanceFailed": "余额读取失败",
			"quoteAction": "引用这条回复作为上下文",
			"quoteHeader": "【引用此前的回复】",
			"quoteHint": "已插入引用标记，发送时自动展开成完整内容",
			"quoteTruncated": "（引用过长，已截断）",
			"quoteDone": "已插入引用",
			"quoteMissing": "输入框不可用，请先把光标放进输入框",
			"peakOn": "峰时",
			"peakOff": "谷时",
			"peakOnTitle": "现在是 DeepSeek 高峰时段（价格 ×1）\n周一至周五 09:00–12:00、14:00–18:00，法定节假日除外",
			"peakOffTitle": "现在是 DeepSeek 空闲时段（半价 ×0.5）\n高峰以外的时间，含周末与法定节假日全天",
			"peakUnknown": "峰谷",
			"shotBusy": "正在截图…",
			"shotDone": "已截好，放进输入框并复制到剪贴板",
			"shotEmpty": "没有截到图",
			"shotUnavailable": "当前环境不支持应用内截图（系统未放开屏幕捕获），请用 ⌘⇧4 截图后按 ⌘V",
			"shotNoEditor": "找不到输入框",
			"shotCopied": "已复制到系统剪贴板，按 ⌘V 放进输入框"
		};
		const en = {
			"amount": "¥{amount}",
			"totalTitle": "This session: {amount} CNY",
			"taskTitle": "This task (turn {turn}): {amount} CNY",
			"billed": "{count} billed requests",
			"peak": "{count} at peak",
			"allOffPeak": "all off-peak",
			"tierPeak": "peak rate ×{mult}",
			"tierOffPeak": "off-peak rate ×{mult}",
			"tierFlat": "single rate (no time-of-day pricing)",
			"times": "{count}×",
			"unit": "rate (CNY / 1M): hit {hit} · miss {miss} · out {out}",
			"unitRaw": "list price $ {hit} / {miss} / {out} per 1M · converted at 1 USD = {fx} CNY",
			"cacheHit": "Cached input",
			"cacheMiss": "Uncached input",
			"output": "Output",
			"cacheWrite": "Cache write",
			"cacheFree": "no cache-write fee",
			"subtotal": "subtotal ¥{amount}",
			"notPriced": "no price found; excluded from the amount",
			"unpricedNote": "Unpriced models: {models}",
			"cacheSaved": "Cache saved you ¥{amount}",
			"offPeakSaved": "Off-peak saved you ¥{amount}",
			"wouldHaveCost": "Would have cost",
			"actualCost": "Actually spent",
			"savedTotal": "Saved in total",
			"panelTitle": "Session cost",
			"panelHint": "click to collapse",
			"tokensHeading": "Token usage",
			"breakdownHeading": "Cost breakdown",
			"offPeakOnly": "only peak/off-peak priced models take the off-peak discount",
			"cacheSavedLabel": "Cache saved you",
			"offPeakSavedLabel": "Off-peak saved you",
			"cacheHitLabel": "Cache hit {percent}",
			"cacheMissLabel": "Uncached input",
			"outputLabel": "Output",
			"taskLabel": "This task (turn {turn})",
			"amountLabel": "Cost",
			"cacheSavedHint": "had these tokens missed the cache, they would bill at the miss rate",
			"unknownVendor": "unknown vendor",
			"balanceTitle": "DeepSeek account balance (click to refresh)",
			"balanceCash": "Credit",
			"balanceBonus": "Bonus",
			"balanceUpdated": "Updated {time}",
			"balanceFailed": "Balance unavailable",
			"quoteAction": "Quote this reply as context",
			"quoteHeader": "[Quoted earlier reply]",
			"quoteHint": "Quote mark inserted; it expands to the full reply on send",
			"quoteTruncated": "(quote truncated: reply was longer)",
			"quoteDone": "Quote inserted",
			"quoteMissing": "Composer unavailable; put the caret in the input first",
			"peakOn": "Peak",
			"peakOff": "Off-peak",
			"peakOnTitle": "DeepSeek peak window (rate ×1)\nMon–Fri 09:00–12:00 and 14:00–18:00 Beijing, public holidays excluded",
			"peakOffTitle": "DeepSeek off-peak window (half rate ×0.5)\nEverything outside peak, weekends and public holidays included",
			"peakUnknown": "Rate",
			"shotBusy": "Capturing…",
			"shotDone": "Captured, placed in the composer and copied to the clipboard",
			"shotEmpty": "Nothing captured",
			"shotUnavailable": "This environment has no in-app screen capture (the app does not enable it); use ⌘⇧4 then ⌘V",
			"shotNoEditor": "Composer not found",
			"shotCopied": "Copied to the system clipboard — press ⌘V to drop it into the composer"
		};
		/** `{name}` substitution, shared by the seat and the built-in fallback. */
		function fill(template, params) {
			return String(template).replace(/\{(\w+)\}/g, (match, key) => (params !== void 0 && Object.hasOwn(params, key) ? String(params[key]) : match));
		}
		/**
		* Read one dictionary entry through the slot's locale seat, falling back to
		* the built-in Chinese dictionary when no seat was supplied.
		* @param t - the slot's translate seat, when the owner projects one.
		* @param key - dictionary key.
		* @param params - substitution values.
		* @returns display text.
		*/
		function tr(t, key, params) {
			if (typeof t === "function") {
				const value = t(key, params);
				if (typeof value === "string" && value.length > 0 && value !== key) return value;
			}
			return fill(Object.hasOwn(zh, key) ? zh[key] : key, params);
		}
		//#endregion

		//#region formatting
		/**
		* Adaptive precision for a money amount: a fresh session costs fractions of
		* a fen, a long one costs yuan.
		* @param value - CNY amount.
		* @returns the amount without its currency mark.
		*/
		function formatCny(value) {
			if (!Number.isFinite(value) || value <= 0) return "0.00";
			if (value >= 1) return value.toFixed(2);
			if (value >= 0.01) return value.toFixed(3);
			return value.toFixed(4);
		}
		/**
		* A unit price, trimmed of trailing zeros so the tooltip reads like a price
		* list rather than a spreadsheet.
		* @param value - price per 1M tokens.
		* @returns display text.
		*/
		function formatRate(value) {
			if (!Number.isFinite(value) || value === 0) return "0";
			if (value >= 1) return String(Math.round(value * 100) / 100);
			if (value >= 0.01) return String(Math.round(value * 1000) / 1000);
			return String(Math.round(value * 1e6) / 1e6);
		}
		/**
		* Compact token count, matching the neighbouring usage pill's scale.
		* @param value - token count.
		* @returns display text.
		*/
		function formatTokens(value) {
			if (!Number.isFinite(value) || value <= 0) return "0";
			if (value >= 1e9) return (value / 1e9).toFixed(2) + "B";
			if (value >= 1e6) return (value / 1e6).toFixed(1) + "M";
			if (value >= 1e3) return (value / 1e3).toFixed(1) + "K";
			return String(Math.round(value));
		}
		/**
		* A wallet amount with its currency mark and digit grouping, following the
		* Platform's own presentation: two decimals, sub-cent shown as `<0.01`.
		* @param amount - the wallet's balance string.
		* @param currency - `CNY`, `USD`, or anything else.
		* @returns display text.
		*/
		function formatWallet(amount, currency) {
			const mark = currency === "CNY" ? "¥" : currency === "USD" ? "$" : String(currency) + " ";
			const value = Number(amount);
			if (!Number.isFinite(value)) return mark + String(amount);
			if (value > 0 && value < 0.01) return mark + "<0.01";
			const magnitude = Math.abs(value) < 0.01 && value !== 0 ? 0.01 : Math.abs(value);
			return (value < 0 ? "-" : "") + mark + magnitude.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		}
		/** Bucket-wise sum of two bucket records. */
		function addBuckets(left, right) {
			return {
				cacheHit: (left?.cacheHit ?? 0) + (right?.cacheHit ?? 0),
				cacheMiss: (left?.cacheMiss ?? 0) + (right?.cacheMiss ?? 0),
				cacheWrite: (left?.cacheWrite ?? 0) + (right?.cacheWrite ?? 0),
				output: (left?.output ?? 0) + (right?.output ?? 0)
			};
		}
		function isZeroBuckets(buckets) {
			return buckets.cacheHit === 0 && buckets.cacheMiss === 0 && buckets.cacheWrite === 0 && buckets.output === 0;
		}
		//#endregion

		//#region breakdown
		/**
		* One model's auditable arithmetic: who served it, which price list was
		* used, whether the peak/off-peak rule applied, the unit prices actually
		* charged, and each bucket's `tokens × rate = amount`.
		* @param entry - the view's per-model record.
		* @param t - translate seat.
		* @returns lines to append to the tooltip.
		*/
		function modelLines(entry, t) {
			const lines = [""];
			const vendor = entry.vendor || entry.provider || tr(t, "unknownVendor");
			const name = entry.label !== void 0 && entry.label !== entry.model ? entry.label + " (" + entry.model + ")" : entry.model;
			lines.push(name + " · " + vendor + (entry.source !== void 0 && entry.source !== "" ? " · " + entry.source : ""));
			if (entry.known !== true) {
				lines.push("  " + tr(t, "notPriced"));
				return lines;
			}
			const rates = entry.rates ?? {};
			const tokens = entry.tokens ?? {};
			const cost = entry.cost ?? {};
			// A vendor without time-of-day pricing bills one rate, so its two
			// wall-clock buckets are reported as the single tier they really are.
			const tiers = entry.peakPriced === true
				? [["peak", tr(t, "tierPeak", { mult: 1 })], ["offPeak", tr(t, "tierOffPeak", { mult: 0.5 })]]
				: [["flat", tr(t, "tierFlat")]];
			for (const pair of tiers) {
				const tier = pair[0];
				const applied = tier === "flat" ? rates.offPeak : rates[tier];
				if (applied === void 0) continue;
				const tierTokens = tier === "flat" ? addBuckets(tokens.peak, tokens.offPeak) : tokens[tier];
				const tierCost = tier === "flat" ? addBuckets(cost.peak, cost.offPeak) : cost[tier];
				const requests = tier === "flat"
					? (entry.requests?.peak ?? 0) + (entry.requests?.offPeak ?? 0)
					: (entry.requests?.[tier] ?? 0);
				if (requests === 0 && isZeroBuckets(tierTokens)) continue;
				lines.push("  " + pair[1] + " · " + tr(t, "times", { count: requests }));
				lines.push("    " + tr(t, "unit", {
					hit: formatRate(applied.cny.cacheHit),
					miss: formatRate(applied.cny.cacheMiss),
					out: formatRate(applied.cny.output)
				}));
				if (entry.fx !== null && entry.fx !== void 0) {
					lines.push("    " + tr(t, "unitRaw", {
						hit: formatRate(applied.vendor.cacheHit),
						miss: formatRate(applied.vendor.cacheMiss),
						out: formatRate(applied.vendor.output),
						fx: entry.fx
					}));
				}
				for (const bucket of ["cacheHit", "cacheMiss", "output"]) {
					if (tierTokens[bucket] === 0) continue;
					lines.push("    " + tr(t, bucket) + " " + formatTokens(tierTokens[bucket])
						+ " × " + formatRate(applied.cny[bucket]) + " = ¥" + formatCny(tierCost[bucket]));
				}
				if ((tierTokens.cacheWrite ?? 0) > 0) {
					lines.push("    " + tr(t, "cacheWrite") + " " + formatTokens(tierTokens.cacheWrite) + " · " + tr(t, "cacheFree"));
				}
			}
			lines.push("  " + tr(t, "subtotal", { amount: formatCny(entry.cny) }));
			return lines;
		}
		/**
		* The hover breakdown of one scope (session or task).
		* @param scope - the session view or one turn entry.
		* @param t - translate seat.
		* @param title - the first line, naming the scope and the amount.
		* @returns multi-line plain text.
		*/
		/**
		* What the off-peak discount saved across one scope, in CNY. DeepSeek bills
		* off-peak at half the peak rate, and `cost.offPeak` is what was actually
		* charged there — so without the discount that same usage would have cost
		* twice as much, and the saving equals the amount spent. Only models the
		* book marks as peak-priced take part; a flat-priced vendor gets no discount
		* and contributes nothing.
		* @param scope - the projection view or one turn's scope.
		* @returns the saving in CNY; 0 when nothing was billed off-peak.
		*/
		function offPeakSaving(scope) {
			let saved = 0;
			for (const entry of Array.isArray(scope?.models) ? scope.models : []) {
				if (entry.known !== true || entry.peakPriced !== true) continue;
				const cost = entry.cost?.offPeak;
				if (cost === void 0) continue;
				for (const bucket of ["cacheHit", "cacheMiss", "cacheWrite", "output"]) {
					if (typeof cost[bucket] === "number") saved += cost[bucket];
				}
			}
			return saved;
		}

		/**
		* What the prompt cache saved across one scope, in CNY. A cached token bills
		* at the hit rate instead of the miss rate, so the saving is the hit tokens
		* times the difference — summed per model and per rate tier, since peak and
		* off-peak carry different numbers. Vendors whose cache is not cheaper
		* (miss <= hit) contribute nothing, and unpriced models are skipped because
		* they have no rates to subtract.
		* @param scope - the projection view or one turn's scope.
		* @returns the saving in CNY; 0 when nothing was cached or nothing is priced.
		*/
		function cacheSaving(scope) {
			let saved = 0;
			for (const entry of Array.isArray(scope?.models) ? scope.models : []) {
				if (entry.known !== true) continue;
				for (const tier of ["peak", "offPeak"]) {
					const rates = entry.rates?.[tier];
					const tokens = entry.tokens?.[tier];
					if (rates === void 0 || tokens === void 0) continue;
					const hit = typeof rates.cny?.cacheHit === "number" ? rates.cny.cacheHit : 0;
					const miss = typeof rates.cny?.cacheMiss === "number" ? rates.cny.cacheMiss : 0;
					if (miss <= hit) continue;
					const hits = typeof tokens.cacheHit === "number" ? tokens.cacheHit : 0;
					saved += (hits * (miss - hit)) / 1e6;
				}
			}
			return saved;
		}

		function describeScope(scope, t, title) {
			const lines = [title];
			lines.push(tr(t, "billed", { count: scope.requests })
				+ " · " + (scope.peakRequests > 0 ? tr(t, "peak", { count: scope.peakRequests }) : tr(t, "allOffPeak")));
			for (const entry of scope.models ?? []) lines.push(...modelLines(entry, t));
			const saved = cacheSaving(scope);
			const offSaved = offPeakSaving(scope);
			if (saved > 0 || offSaved > 0) {
				lines.push("");
				if (saved > 0) {
					lines.push(tr(t, "cacheSaved", { amount: formatCny(saved) }));
					lines.push("  " + tr(t, "cacheSavedHint"));
				}
				if (offSaved > 0) lines.push(tr(t, "offPeakSaved", { amount: formatCny(offSaved) }));
			}
			if (Array.isArray(scope.unpriced) && scope.unpriced.length > 0) {
				lines.push("");
				lines.push(tr(t, "unpricedNote", { models: scope.unpriced.join(", ") }));
			}
			return lines.join("\n");
		}
		//#endregion

		//#region cost panel
		/**
		* One row of the panel.
		* @param props - `label`, `value`, and optional `muted` / `save` styling.
		* @returns the row element.
		*/
		function PanelRow(props) {
			const cls = "dshSym_panelRow" + (props.save === true ? " dshSym_panelSave" : "") + (props.muted === true ? " dshSym_panelMuted" : "");
			return React.createElement("div", { className: cls }, [
				React.createElement("span", { key: "l" }, props.label),
				React.createElement("span", { key: "v" }, props.value)
			]);
		}

		/**
		* Compact token count, matching the shipped usage readout's feel.
		* @param value - token count.
		* @returns e.g. `1.2M` or `745K`.
		*/
		function formatTokens(value) {
			if (typeof value !== "number" || !Number.isFinite(value)) return "0";
			if (value >= 1e6) return (value / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
			if (value >= 1e3) return (value / 1e3).toFixed(value >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "K";
			return String(value);
		}

		/**
		* Sum one token bucket across every model in a scope.
		* @param scope - the projection view or one turn's scope.
		* @param bucket - `cacheHit` / `cacheMiss` / `cacheWrite` / `output`.
		* @returns the total.
		*/
		function totalTokens(scope, bucket) {
			let sum = 0;
			for (const entry of Array.isArray(scope?.models) ? scope.models : []) {
				for (const tier of ["peak", "offPeak"]) {
					const value = entry.tokens?.[tier]?.[bucket];
					if (typeof value === "number") sum += value;
				}
			}
			return sum;
		}

		/**
		* The click-to-open cost panel. The shipped usage readout opens a dialog the
		* same way, but its `useStatDialog` hook and stylesheet are private, so this
		* measures its own trigger and portals its own card. Content: what the
		* Session actually cost, what the cache and the off-peak discount saved, what
		* it would have cost without them, and the token / per-model breakdown.
		* @param props - `scope` (the view), `task` (the selected turn's scope or null), `t`.
		* @returns the trigger and, while open, the portalled panel.
		*/
		function CostPanel(props) {
			const t = props.t;
			const scope = props.scope;
			const task = props.task;
			const [open, setOpen] = React.useState(false);
			const [pos, setPos] = React.useState(null);
			const wrapRef = React.useRef(null);
			const toggle = () => {
				if (!open && wrapRef.current !== null) {
					const rect = wrapRef.current.getBoundingClientRect();
					setPos({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 300)), bottom: Math.max(8, window.innerHeight - rect.top + 8) });
				}
				setOpen(!open);
			};
			const savedCache = cacheSaving(scope);
			const savedOff = offPeakSaving(scope);
			const spent = typeof scope.cny === "number" ? scope.cny : 0;
			const wouldHave = spent + savedCache + savedOff;
			const hitTokens = totalTokens(scope, "cacheHit");
			const missTokens = totalTokens(scope, "cacheMiss");
			const outTokens = totalTokens(scope, "output");
			const hitPercent = hitTokens + missTokens > 0 ? (hitTokens / (hitTokens + missTokens) * 100).toFixed(1) + "%" : "—";
			const rows = [];
			rows.push(React.createElement("div", { className: "dshSym_panelRow", key: "spent" }, [
				React.createElement("span", { key: "l" }, tr(t, "actualCost")),
				React.createElement("span", { key: "v" }, tr(t, "amount", { amount: formatCny(spent) }))
			]));
			if (savedCache > 0) rows.push(React.createElement(PanelRow, { key: "c", label: tr(t, "cacheSavedLabel"), value: "¥" + formatCny(savedCache), save: true }));
			if (savedOff > 0) rows.push(React.createElement(PanelRow, { key: "o", label: tr(t, "offPeakSavedLabel"), value: "¥" + formatCny(savedOff), save: true }));
			rows.push(React.createElement("div", { className: "dshSym_panelRule", key: "r1" }));
			rows.push(React.createElement(PanelRow, { key: "w", label: tr(t, "wouldHaveCost"), value: "¥" + formatCny(wouldHave) }));
			rows.push(React.createElement("div", { className: "dshSym_panelHeading", key: "h1" }, tr(t, "tokensHeading")));
			rows.push(React.createElement(PanelRow, { key: "t1", label: tr(t, "cacheHitLabel", { percent: hitPercent }), value: formatTokens(hitTokens) + " tok", muted: true }));
			rows.push(React.createElement(PanelRow, { key: "t2", label: tr(t, "cacheMissLabel"), value: formatTokens(missTokens) + " tok", muted: true }));
			rows.push(React.createElement(PanelRow, { key: "t3", label: tr(t, "outputLabel"), value: formatTokens(outTokens) + " tok", muted: true }));
			if (task !== null && task !== void 0) {
				// The heading already names the turn, so this row carries the amount.
				rows.push(React.createElement("div", { className: "dshSym_panelHeading", key: "h2" }, tr(t, "taskLabel", { turn: task.turn })));
				rows.push(React.createElement(PanelRow, { key: "taskCost", label: tr(t, "amountLabel"), value: "¥" + formatCny(task.cny), muted: true }));
			}
			const panel = open && pos !== null && ReactDOM !== null
				? ReactDOM.createPortal(React.createElement("div", {
					className: "dshSym_panel",
					role: "dialog",
					"aria-label": tr(t, "panelTitle"),
					style: { left: pos.left + "px", bottom: pos.bottom + "px" },
					"data-sym-cost-panel": true
				}, [
					React.createElement("div", { className: "dshSym_panelTitle", key: "t" }, [
						React.createElement("span", { key: "l" }, tr(t, "panelTitle")),
						React.createElement("span", { className: "dshSym_panelMuted", key: "v" }, tr(t, "amount", { amount: formatCny(spent) }))
					]),
					React.createElement("div", { className: "dshSym_panelRule", key: "r0" }),
					...rows
				]), document.body)
				: null;
			return React.createElement("span", { className: "dshSym_panelWrap", ref: wrapRef }, [
				React.createElement("span", { key: "g", onClick: toggle, style: { display: "contents" } }, props.children),
				panel
			]);
		}
		//#endregion

		//#region active turn
		/**
		* The turn the chat's right-hand rail currently marks. The shipped Chat view
		* keeps that selection in component-local state and projects it to no slot,
		* so the rail's own accessibility contract is the readable source: the active
		* mark is the only `button[aria-current="true"]` inside a navigation whose
		* marks are labelled with their turn number.
		* @returns the active turn number, or null when no rail is on screen.
		*/
		function readActiveTurn() {
			if (typeof document === "undefined") return null;
			for (const nav of document.querySelectorAll("nav")) {
				const marks = nav.querySelectorAll("button");
				if (marks.length < 2) continue;
				let labelled = 0;
				for (const mark of marks) if (/\d/.test(mark.getAttribute("aria-label") || "")) labelled += 1;
				// A nav whose marks are numbered is the turn rail; the sidebar and
				// header navs are not.
				if (labelled < 2) continue;
				const active = nav.querySelector('button[aria-current="true"]');
				if (active === null) continue;
				const match = /\d+/.exec(active.getAttribute("aria-label") || "");
				if (match !== null) return Number(match[0]);
			}
			return null;
		}
		/**
		* Follow the rail's active mark across scroll and click, coalesced to one
		* read per animation frame.
		* @returns the active turn number, or null.
		*/
		function useActiveTurn() {
			const [turn, setTurn] = React.useState(() => readActiveTurn());
			React.useEffect(() => {
				let frame = 0;
				const sync = () => {
					frame = 0;
					const next = readActiveTurn();
					setTurn((previous) => (previous === next ? previous : next));
				};
				const schedule = () => {
					if (frame === 0) frame = requestAnimationFrame(sync);
				};
				const observer = new MutationObserver(schedule);
				observer.observe(document.body, {
					subtree: true,
					childList: true,
					attributes: true,
					attributeFilter: ["aria-current"]
				});
				schedule();
				return () => {
					observer.disconnect();
					if (frame !== 0) cancelAnimationFrame(frame);
				};
			}, []);
			return turn;
		}
		/**
		* Pick the task to price: the rail's selection when the log folded it,
		* otherwise the newest turn.
		* @param turns - the view's per-turn entries, ascending.
		* @param activeTurn - the rail's active turn number.
		* @returns the entry, or null.
		*/
		function pickTurn(turns, activeTurn) {
			if (turns.length === 0) return null;
			if (activeTurn !== null) {
				const hit = turns.find((entry) => entry.turn === activeTurn);
				if (hit !== void 0) return hit;
			}
			return turns[turns.length - 1];
		}
		//#endregion

		//#region account balance
		/** Last balance read, so a remounted cell has something to paint immediately. */
		let balanceCache = null;

		/** How often a mounted balance cell re-reads while it has a figure to keep fresh. */
		const BALANCE_REFRESH_MS = 60000;
		/** The slower beat used while there is nothing to show, e.g. after a sign-out. */
		const BALANCE_RETRY_MS = 300000;

		/**
		* Build the sidebar-foot balance cell for one plugin context. The account
		* Remote namespace is captured in the closure, so the component needs no
		* extra slot hook and never holds a stale service.
		* @param ctx - the client context that injected `remote.account`.
		* @returns the slot component.
		*/
		function createBalanceCell(ctx) {
			/** The identity headers the Platform expects from this UI, read per call. */
			const clientIdentity = () => {
				let locale = "zh-CN";
				try {
					const snapshot = ctx.locale.getSnapshot();
					if (typeof snapshot?.active === "string") locale = snapshot.active;
				} catch { /* keep the default tag */ }
				return {
					version: "unknown",
					locale,
					timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60
				};
			};
			return function BalanceCell(props) {
				// Seeded from the last read so a remount paints the figure at once
				// instead of blinking through an empty first frame.
				const [state, setState] = React.useState(() => balanceCache ?? { status: "loading" });
				const alive = React.useRef(true);
				const read = React.useCallback(async () => {
					let next;
					try {
						const result = await ctx.remote.account.getBalance(clientIdentity());
						const value = result !== null && result !== void 0 && result.ok === true ? result.value : null;
						if (value === null || value === void 0 || value.status !== "ready") {
							next = { status: "unavailable" };
						} else {
							next = {
								status: "ready",
								wallets: Array.isArray(value.value) ? value.value : [],
								bonusWallets: Array.isArray(value.bonusWallets) ? value.bonusWallets : [],
								at: Date.now()
							};
						}
					} catch {
						next = { status: "unavailable" };
					}
					balanceCache = next;
					if (alive.current) setState(next);
				}, []);
				React.useEffect(() => {
					alive.current = true;
					read();
					return () => {
						alive.current = false;
					};
				}, [read]);
				// Re-read on a slow beat, and much more slowly while there is no
				// balance to show, so a signed-out client barely touches the account
				// seam.
				const period = state.status === "ready" ? BALANCE_REFRESH_MS : BALANCE_RETRY_MS;
				React.useEffect(() => {
					const timer = setInterval(read, period);
					return () => {
						clearInterval(timer);
					};
				}, [read, period]);
				const t = props.t;
				// The collapsed rail has no room for a figure.
				if (props.wide === false) return null;
				if (state.status !== "ready") return null;
				const wallet = pickWallet(state.wallets);
				if (wallet === null) return null;
				const bonus = pickWallet(state.bonusWallets);
				const lines = [tr(t, "balanceTitle")];
				lines.push(tr(t, "balanceCash") + " " + formatWallet(wallet.balance, wallet.currency));
				if (bonus !== null && bonus !== void 0) lines.push(tr(t, "balanceBonus") + " " + formatWallet(bonus.balance, bonus.currency));
				const clock = new Date(state.at);
				lines.push(tr(t, "balanceUpdated", {
					time: String(clock.getHours()).padStart(2, "0") + ":" + String(clock.getMinutes()).padStart(2, "0")
				}));
				const title = lines.join("\n");
				return React.createElement("button", {
					type: "button",
					className: "dshBalance_root",
					title,
					"aria-label": title,
					"data-account-balance": true,
					onClick: () => {
						read();
					}
				}, [
					React.createElement(WalletGlyph, { key: "glyph" }),
					React.createElement("span", { className: "dshBalance_value", key: "value" }, formatWallet(wallet.balance, wallet.currency))
				]);
			};
		}

		/**
		* The wallet to show on the cell: the CNY credit wallet when the account has
		* one, otherwise whatever credit wallet the Platform returned.
		* @param wallets - the account's credit wallets.
		* @returns the chosen wallet, or null.
		*/
		function pickWallet(wallets) {
			if (!Array.isArray(wallets) || wallets.length === 0) return null;
			return wallets.find((wallet) => wallet !== null && typeof wallet === "object" && wallet.currency === "CNY") ?? wallets[0];
		}

		/** The wallet glyph: a stacked-coins mark, distinct from the cost cells' marks. */
		function WalletGlyph() {
			return React.createElement("svg", {
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3
			}, React.createElement("rect", { x: "1.4", y: "3.6", width: "13.2", height: "8.8", rx: "2" }), React.createElement("path", { d: "M1.4 6.6h13.2" }), React.createElement("circle", { cx: "11.2", cy: "9.6", r: "1.1", fill: "currentColor", stroke: "none" }));
		}

		//#endregion

		//#region turn cost
		/**
		* The Turn a durable assistant message belongs to, read from the chat store.
		* @param order - the store's node keys, in transcript order.
		* @param nodes - the store's node map.
		* @param messageId - the durable assistant message id.
		* @returns the Turn number, or null.
		*/
		function findMessageTurn(order, nodes, messageId) {
			if (!Array.isArray(order) || messageId === undefined) return null;
			for (const key of order) {
				const node = nodes.get(key);
				const data = node?.data;
				if (data === undefined) continue;
				const id = data.messageId ?? data.finalNode?.messageId;
				if (id !== messageId) continue;
				const turn = data.turn ?? data.finalNode?.turn;
				return typeof turn === "number" ? turn : null;
			}
			return null;
		}

		/**
		* What this one Turn cost, shown on that Turn's own action row rather than
		* only on the composer readout. The row's usage figure and its clock share one
		* flex container, so `order` seats this cell between them.
		* @param props - slot props; `messageId` names the reply.
		* @returns the cell, or null when this Turn has no priced usage.
		*/
		function TurnCostCell(props) {
			const useProjection = props.useProjection;
			const useChat = props.useChat;
			const t = props.t;
			const messageId = props.messageId;
			const view = useProjection("sessionCost");
			const turn = useChat((state) => findMessageTurn(state.order, state.nodes, messageId));
			if (view === null || view === void 0 || turn === null) return null;
			const turns = Array.isArray(view.turns) ? view.turns : [];
			const scope = turns.find((item) => item.turn === turn);
			if (scope === void 0) return null;
			return React.createElement("span", {
				className: "dshSymTurnCost",
				title: describeScope(scope, t, tr(t, "taskTitle", { turn, amount: formatCny(scope.cny) })),
				"data-sym-turn-cost": String(turn)
			}, [
				React.createElement(TaskGlyph, { key: "g" }),
				React.createElement("span", { key: "v" }, tr(t, "amount", { amount: formatCny(scope.cny) }))
			]);
		}
		//#endregion

		//#region peak tag
		/**
		* Chinese statutory public holidays in Beijing time, mirroring the host
		* half's table. The brand row is root-scoped, so it has no Session projection
		* to read and works the window out locally.
		*/
		const PEAK_HOLIDAYS = new Set([
			"2026-01-01", "2026-01-02", "2026-01-03",
			"2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19",
			"2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23",
			"2026-04-04", "2026-04-05", "2026-04-06",
			"2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
			"2026-06-19", "2026-06-20", "2026-06-21",
			"2026-09-25", "2026-09-26", "2026-09-27",
			"2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05",
			"2026-10-06", "2026-10-07"
		]);

		/**
		* Whether DeepSeek bills its peak rate right now: Beijing time, Monday to
		* Friday, public holidays excluded, 09:00–12:00 and 14:00–18:00.
		* @param now - epoch milliseconds.
		* @returns true inside a peak window.
		*/
		function isPeakNow(now) {
			const shifted = new Date(now + 8 * 60 * 60 * 1000);
			const day = shifted.getUTCDay();
			if (day === 0 || day === 6) return false;
			const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
			const date = String(shifted.getUTCFullYear()) + "-" + month + "-" + String(shifted.getUTCDate()).padStart(2, "0");
			if (PEAK_HOLIDAYS.has(date)) return false;
			const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
			return (minutes >= 9 * 60 && minutes < 12 * 60) || (minutes >= 14 * 60 && minutes < 18 * 60);
		}

		/**
		* The live DeepSeek rate window as a small tag. It re-reads every half minute,
		* which is far finer than the two daily boundaries it can cross.
		* @param props - slot props; `t` is the locale seat.
		* @returns the tag.
		*/
		function PeakTag(props) {
			const t = props.t;
			const [peak, setPeak] = React.useState(() => isPeakNow(Date.now()));
			React.useEffect(() => {
				const timer = setInterval(() => {
					setPeak(isPeakNow(Date.now()));
				}, 30000);
				return () => {
					clearInterval(timer);
				};
			}, []);
			const title = peak ? tr(t, "peakOnTitle") : tr(t, "peakOffTitle");
			return React.createElement("span", {
				className: "dshPeakTag " + (peak ? "dshPeakOn" : "dshPeakOff"),
				title,
				"aria-label": title,
				"data-peak-now": peak ? "peak" : "off-peak"
			}, peak ? tr(t, "peakOn") : tr(t, "peakOff"));
		}
		//#endregion

		/** Beijing hours where DeepSeek's rate window can flip. */
		const PEAK_BOUNDARY_HOURS = [9, 12, 14, 18];

		/**
		* Milliseconds from `now` until the next instant the rate window can change:
		* the coming Beijing boundary hour, or the coming midnight — which can flip a
		* weekend or a holiday on its own. Answering the exact gap lets the tag flip
		* on the boundary instead of up to one poll interval late.
		* @param now - epoch milliseconds.
		* @returns milliseconds until the next possible change.
		*/
		function msUntilRateChange(now) {
			const shifted = new Date(now + 8 * 60 * 60 * 1000);
			const intoDay = ((shifted.getUTCHours() * 60 + shifted.getUTCMinutes()) * 60 + shifted.getUTCSeconds()) * 1000 + shifted.getUTCMilliseconds();
			const hour = 60 * 60 * 1000;
			for (const boundary of PEAK_BOUNDARY_HOURS) {
				if (boundary * hour > intoDay) return boundary * hour - intoDay;
			}
			return 24 * hour - intoDay;
		}

		/**
		* Publish the live DeepSeek rate window on the document root. The brand row
		* is a shipped element with no additive seat, so the tag rides its `::after`
		* instead: CSS takes the label from a custom property and the peak/off-peak
		* colour from a data attribute. Nothing is replaced, and unloading the plugin
		* removes both again.
		*
		* The timer lands just past the next boundary instead of polling on an
		* interval, and every return to the surface re-reads the clock — a background
		* timer can be throttled by minutes, and waking from sleep can leave it stale.
		* @param ctx - client root context, which owns the timer's lifetime.
		*/
		function installPeakTag(ctx) {
			const root = document.documentElement;
			const sync = () => {
				const peak = isPeakNow(Date.now());
				root.style.setProperty("--dsh-peak-label", JSON.stringify(peak ? tr(null, "peakOn") : tr(null, "peakOff")));
				root.dataset.dshPeak = peak ? "peak" : "off";
			};
			ctx.effect(() => {
				let timer = 0;
				const schedule = () => {
					sync();
					// Re-arm from the clock every time, so drift never accumulates.
					timer = setTimeout(schedule, msUntilRateChange(Date.now()) + 500);
				};
				const wake = () => {
					if (document.visibilityState === "hidden") return;
					clearTimeout(timer);
					schedule();
				};
				schedule();
				document.addEventListener("visibilitychange", wake);
				window.addEventListener("focus", wake);
				return () => {
					clearTimeout(timer);
					document.removeEventListener("visibilitychange", wake);
					window.removeEventListener("focus", wake);
					root.style.removeProperty("--dsh-peak-label");
					delete root.dataset.dshPeak;
				};
			}, "dsh-sym: peak window tag");
		}

		//#region quote action
		/**
		* The durable mark a quote action writes into the composer. The host half
		* expands it back into the named reply as the message enters the step, so the
		* draft stays one short token while the model still reads the whole answer.
		* @param messageId - the durable assistant message id.
		* @returns the mark to insert.
		*/
		function quoteMark(messageId) {
			return "@引用#" + String(messageId).replace(/-/g, "").slice(0, 12).toLowerCase();
		}

		/**
		* One finalized reply's quote action: it drops that short mark into the
		* composer, and the host expands it when the message is submitted.
		* @param props - slot props; `messageId` names the reply.
		* @returns the button.
		*/
		function QuoteAction(props) {
			const inputActions = props.inputActions;
			const t = props.t;
			const messageId = props.messageId;
			const [flag, setFlag] = React.useState(null);
			React.useEffect(() => {
				if (flag === null) return undefined;
				const timer = setTimeout(() => {
					setFlag(null);
				}, 2000);
				return () => {
					clearTimeout(timer);
				};
			}, [flag]);
			if (typeof messageId !== "string" || messageId.length === 0) return null;
			const pick = () => {
				const payload = quoteMark(messageId) + " ";
				// Capture the caret first: the click moved focus, and `insertText`
				// applies to the insertion point captured for this edit.
				let span;
				try {
					span = typeof inputActions.captureInsertion === "function" ? inputActions.captureInsertion() : undefined;
				} catch {
					span = undefined;
				}
				let ok = false;
				try {
					ok = inputActions.insertText(payload, span) !== false;
				} catch {
					ok = false;
				}
				setFlag(ok ? "done" : "missing");
			};
			const label = flag === "done" ? tr(t, "quoteDone") : flag === "missing" ? tr(t, "quoteMissing") : tr(t, "quoteAction");
			return React.createElement("button", {
				type: "button",
				className: "dshQuoteAction",
				title: label,
				"aria-label": label,
				"data-quote-action": messageId,
				onClick: pick
			}, flag === null
				? React.createElement("span", { className: "dshQuoteMark", "aria-hidden": true }, "@")
				: React.createElement("span", { className: "dshQuoteFlag", "aria-hidden": true }, flag === "done" ? "\u2713" : "!"));
		}
		//#endregion

		//#region cost component
		/**
		* A banknote, marking the whole-session figure.
		*/
		function SessionGlyph() {
			return React.createElement("svg", {
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3
			}, React.createElement("rect", { x: "1.3", y: "4.1", width: "13.4", height: "7.8", rx: "1.6" }), React.createElement("circle", { cx: "8", cy: "8", r: "1.9" }));
		}
		/**
		* A speech bubble: the task figure is one turn of this conversation, and the
		* bubble is the row's own word for that. The earlier tick-on-a-track mark
		* read as a slider, not as one task's cost.
		*/
		function TaskGlyph() {
			return React.createElement("svg", {
				viewBox: "0 0 16 16",
				"aria-hidden": true,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.3,
				strokeLinejoin: "round"
			}, React.createElement("rect", { x: "1.8", y: "3.0", width: "12.4", height: "8.0", rx: "2" }), React.createElement("path", { d: "M4.9 10.9v2.6l3.1-2.6" }));
		}
		/**
		* One cost cell: leading glyph and the amount.
		* @param props - glyph, amount text, breakdown text, and a test hook.
		* @returns the pill element.
		*/
		function CostCell(props) {
			return React.createElement("span", {
				className: "dshSym_pill",
				title: props.title,
				"aria-label": props.title,
				"data-sym-cost-part": props.part
			}, [
				React.createElement(props.glyph, { key: "glyph" }),
				React.createElement("span", { className: "dshSym_label", key: "label" }, props.text)
			]);
		}
		/**
		* Ordered `conversation.composer.dock` entry: the session's running cost,
		* then the cost of the task the rail has selected — both in RMB, after the
		* shipped statistics pills.
		* @param props - slot standard props; `useProjection` reads the host value.
		* @returns the cells, or null while nothing has been billed yet.
		*/
		function CostPill(props) {
			const useProjection = props.useProjection;
			const view = useProjection("sessionCost");
			const activeTurn = useActiveTurn();
			if (view === null || view === void 0 || !(view.requests > 0)) return null;
			const t = props.t;
			const turns = Array.isArray(view.turns) ? view.turns : [];
			const task = pickTurn(turns, activeTurn);
			const cells = [React.createElement(CostCell, {
				key: "session",
				part: "session",
				glyph: SessionGlyph,
				text: tr(t, "amount", { amount: formatCny(view.cny) }) + (Array.isArray(view.unpriced) && view.unpriced.length > 0 ? "*" : ""),
				title: describeScope(view, t, tr(t, "totalTitle", { amount: formatCny(view.cny) }))
			})];
			// One turn means the task figure would just repeat the session figure.
			if (turns.length >= 2 && task !== null) {
				cells.push(React.createElement(CostCell, {
					key: "task",
					part: "task",
					glyph: TaskGlyph,
					text: tr(t, "amount", { amount: formatCny(task.cny) }),
					title: describeScope(task, t, tr(t, "taskTitle", { turn: task.turn, amount: formatCny(task.cny) }))
				}));
			}
			return React.createElement(CostPanel, { scope: view, task, t }, React.createElement("span", {
				className: "dshSym_root",
				"data-sym-cost": true,
				"data-sym-cost-turn": task === null ? "" : String(task.turn)
			}, cells));
		}
		//#endregion

		//#region plugin
		/**
		* The brand wordmark component, when this deployment ships it. Absence is not
		* an error: the sidebar keeps its own name and only the rate tag is lost.
		* @returns the primitives module, or null.
		*/
		function brandPrimitives() {
			try {
				const module = require("@deepseek-ai/dsh-client-ui-primitives");
				return module !== null && typeof module === "object" && module.BrandWordmark !== void 0 ? module : null;
			} catch {
				return null;
			}
		}

		/** The slot and locale registries are this entry's base outreach. */
		const inject = ["slots", "locale"];
		/**
		* Claim one additive cell in the composer's ambient dock, ordered after the
		* shipped `stats` cell so the cost reads as the last figures of the group.
		* The balance cell is registered separately and only when the account Remote
		* namespace is present, so a deployment without it still gets the cost cells.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-sym: dictionaries");
			installPeakTag(ctx);
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
				name: "conversation.composer.dock",
				id: "sym-cost",
				order: 10,
				locale: NS
			}, CostPill));
			// Quote action on every finalized reply. It needs only the chat store and
			// the composer actions, so it registers unconditionally.
			ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
				name: "conversation.chat.assistant-actions",
				id: "turn-cost",
				order: 30,
				locale: NS
			}, TurnCostCell));
			ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
				name: "conversation.chat.assistant-actions",
				id: "quote-reference",
				order: 20,
				locale: NS
			}, QuoteAction));
			// Optional dependency: without an account Remote this whole block stays
			// inert and the cost cells above are unaffected. Both the `remote`
			// service and its `account` namespace are required — the namespace
			// alone leaves `ctx.remote` undefined.
			ctx.inject(["remote", "remote.account"], (child) => {
				child.slots.inject("sidebar.footer.action", () => child.slots.register({
					name: "sidebar.footer.action",
					id: "account-balance",
					order: 10,
					locale: NS
				}, createBalanceCell(child)));
			});
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		exports.formatCny = formatCny;
		exports.formatRate = formatRate;
		exports.formatWallet = formatWallet;
		exports.pickWallet = pickWallet;
		exports.readActiveTurn = readActiveTurn;
		exports.pickTurn = pickTurn;
		exports.describeScope = describeScope;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
