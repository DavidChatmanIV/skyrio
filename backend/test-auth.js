import { json } from "express";
import fetch from "node-fetch";

const res = await fetch("http://localhost:4000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    emailOrUsername: "quintel14@gmail.com",
    password: "Blackking12#",
  }),
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
