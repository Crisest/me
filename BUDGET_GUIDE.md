# Using the Budget

Your budget used to only know what you earned and what you spent. Now it knows
what you *meant* to spend, and tells you whether you held to it.

The idea is simple: you make a few named **categories** with a planned amount,
you file transactions into them, and the budget page shows planned against
actual for whatever month you're looking at.

---

## The three kinds of category

Every category is one of three kinds. The kind is the only thing that changes
how a category behaves, so it's worth getting right.

| Kind | What it's for | Planned amount | How many transactions a month | What it costs you |
|---|---|---|---|---|
| **Fixed** | Bills that are the same every month — rent, insurance, phone | Required | One | The plan, until the real charge lands — then whatever actually hit |
| **Flexible** | Envelopes you spend down — groceries, eating out, gas | Required, treated as a cap | As many as you like | Exactly what you spent |
| **Not spending** | Credit-card payments, transfers between your own accounts | None | As many as you like | Nothing at all |

**Fixed** is the interesting one. Rent costs you its planned amount from the
first of the month, even before the charge appears — so a month with rent still
outstanding doesn't look flush. Once the charge lands, it costs the real amount
instead. Rent never gets counted twice.

**Flexible** is the opposite: the planned amount is just a line to compare
against. Spend $520 against a $600 grocery plan and the month costs you $520.

**Not spending** exists for one specific annoyance. When you pay your credit
card, the money leaving your chequing account looks exactly like a purchase.
Filing those into a "not spending" category takes them out of the math
entirely — they stop counting as spending, and they stop sitting in Untagged
nagging you.

---

## Setting it up

**Go to Budget** (it's also what you land on when you open the app).

1. Hit **New category**.
2. Give it a name, pick the kind, and set the planned amount. (You won't be
   asked for an amount on a *not spending* category — it doesn't have one.)
3. Repeat until your regular months are covered. Most people end up with a
   handful of fixed bills, three or four flexible envelopes, and one
   "Card payments & transfers".

If the app spots transactions that look like card payments or transfers and you
don't have a "not spending" category yet, it'll offer to make one for you with a
single click. Take it.

To change or delete a category later, **click its name** on the budget page.
Deleting a category doesn't delete any transactions — it just unfiles them, and
they go back to being untagged.

---

## Filing transactions

Filing is manual and takes a second.

1. Go to **Transactions**.
2. On any row, open the action menu and choose **Assign to category**.
3. Pick the category. Done — the budget page updates immediately.

A few things the dialog does for you:

- If a transaction looks like a card payment or transfer, your *not spending*
  category is **pre-selected**. Just confirm.
- A **fixed** category that already has its transaction for that month won't be
  offered again — that's the once-a-month rule doing its job.
- Flexible and not-spending categories are always available, however many
  transactions they already hold.

To unfile something, use **Remove from "…"** in the same menu.

Only money going *out* can be filed. Refunds and income aren't spending, so
they're not offered a category.

---

## Reading the budget page

Pick a month and year at the top; everything below follows it.

**The four cards across the top:**

- **Projected Income** — your salary. It says *Actual Income* instead once
  you've recorded what actually landed for that month.
- **Planned** — everything you said you'd spend, added up.
- **Total Cost** — what the month actually costs you, including untagged.
- **Money Left** — income minus total cost. The number that matters.

**Each category row** shows `spent / planned`, with a bar underneath. The bar
turns red and the numbers go red when you're over. *Not spending* rows show
their total marked `excluded` and get no bar — they're not part of the math.

**Untagged**, at the bottom, is everything you've spent that you haven't filed
yet. It still counts against Money Left — money spent is money spent whether or
not you've filed it. Treat a big untagged number as a to-do list.

The arithmetic, if you want it:

```
Money Left = income
           − what fixed categories cost (plan, or the real charge once it lands)
           − what flexible categories actually cost
           − untagged spending
```

Not-spending categories appear nowhere in that.

---

## Targets for one month only

Some months aren't normal. Christmas groceries aren't June groceries.

Click the **amounts on a category row** to set a target for *that month alone*.
The row gets a **custom** badge so you can see at a glance that it's not your
usual number. **Reset** puts it back to the standing plan.

The standing plan is untouched — next month goes back to normal on its own.
Not-spending categories can't have a monthly target, since they have no plan to
override.

---

## A workflow that works

- **Once**, when you start: create your categories.
- **Weekly, a couple of minutes**: open Transactions, file anything new,
  starting with card payments so they drop out of the math.
- **End of month**: open Budget, look at Planned against Total Cost. That's the
  "we wanted $2,600 and spent $2,710" conversation, with the per-category
  breakdown showing you exactly where the $110 went.

---

## Things worth knowing

- **Categories are yours alone.** Group dashboards still summarise per member;
  there are no shared categories yet.
- **Nothing rolls over.** An under-spent envelope doesn't top up next month.
- **Filing is always manual.** Nothing is categorised behind your back — the
  transfer pre-selection is only a suggestion in the dialog, and it isn't saved
  anywhere until you confirm.
- **Your old fixed expenses carried over** as *fixed* categories, keeping every
  transaction that was already matched to them.
