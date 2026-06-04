# server/

Server-only logic: Server Actions and privileged data access. Every action must
verify session, role, facility, and department access before mutating data
(Engineering Standards §3). Never import this code into Client Components.
