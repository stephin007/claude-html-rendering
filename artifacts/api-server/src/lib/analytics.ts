import { OpenPanel } from "@openpanel/sdk";

export const op = new OpenPanel({
  clientId: process.env.OPENPANEL_CLIENT_ID ?? "",
  clientSecret: process.env.OPENPANEL_CLIENT_SECRET ?? "",
});
