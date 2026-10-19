# Original Challenge Brief

> **Provenance:** this is the brief supplied with the challenge, preserved **verbatim** below so that every
> requirement in [`plan.md`](./plan.md) is traceable back to its source. Nothing here has been edited.
>
> **Where this document and the plan disagree, the brief wins.** The plan is our interpretation of it.

## Known defect in the source brief

The task numbering restarts partway through, and one task lost its header entirely. This is a
defect in the brief as supplied, not a transcription error here. The observed labels are:

| Label in brief | Task |
|---|---|
| Task 01 | Backend: Lost & Found API |
| Task 02 | Frontend: Interactive calculator |
| Task 03 | Problem solving (binary string) |
| Task 01 | Auto complete search box |
| Task 02 | Backend: Auth API |
| *(no number — header line is only "svg")* | Smallest missing positive |
| Task 01 | Backend: Flash Sale API |

Three tasks are labelled "Task 01" and two are labelled "Task 02". Because of this, the project
**does not use the brief's numbering** for routes, directories, or documentation. Each task is
referred to by a stable descriptive name instead (`/tasks/flash-sale`, not `/tasks/01`).

---

## Brief (verbatim)

Task 01: Backend : Lost & Found APIsvg
Description
Build an API that allows users to report lost items, report found items, search and filter reported items, view the details of the item, update their own reports & mark an item as recovered .
Instructions
- You are free to use any technology you want.
- No frontend is required

Task 02: Frontend : Interactive calculatorsvg
Description
Build a working calculator UI with keyboard support and proper operator precedence handling in vanilla JS.
Instructions
- You must use only HTML/CSS and javascript with no framework

Task 03: Problem solvingsvg
Description
Given an array of string nums containing n unique binary strings each of length n, return a binary string of length n that does not appear in nums. If there are multiple answers, you may return any of them.
Instructions
- You can write your solution in any language you want.

Task 01: Auto complete search boxsvg
Description
Build a performant client side search box that supports auto completion, from the given dataset.
Instructions
- You should write the auto completion algorithm.
- The dataset should be the one given (data.js).
- It should support mid-word matches ( typing land returns you iceland, ireland...)
- Accents and apostrophes should be handled too for example ( cote d'ivoire ) returns côte d'ivoire too ...

Task 02: Backend : Auth APIsvg
Description
Build signup/login endpoints with password hashing and JWT issuing/verification.
Instructions
- In this problem, you will be asked to build secured signup/login endpoints & JWT issuing and verification in any language/framework of your choice

svg
Description
Given an unsorted integer array nums. Return the smallest positive integer ( n > 0 ) that is not present in nums.
Instructions
- for example, as an input we have : arr = [0, -2, 1, 2], The output here is going to be 3, since 1 & 2 are already available.

Task 01: Backend: Flash Sale APIsvg
Description
An online store is preparing for a limited time flash sale. Some products have only a few units available, but hundreds of customers may try to purchase them at almost exactly the same time.
Instructions
Using any language/framework that you want, Build a backend API for this store, where users can : Browse products, view available stock, place an order and view their orders.

When multiple users attempt to purchase the same product at the same time, the backend must prevent stock from going negative, ensure a product isn't oversold, correctly handle simultaneous requests, return an appropriate message when the product is sold out, prevent a client from accidentally creating multiple orders by retrying the same request.