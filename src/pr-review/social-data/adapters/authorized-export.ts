import { SocialDataError } from "../errors.js";
import { LocalFixtureSocialAdapter } from "./local-fixture.js";

export class AuthorizedExportSocialAdapter extends LocalFixtureSocialAdapter {
  constructor(input: unknown) {
    const fixture = input as { accessMode?: unknown; provenance?: unknown };
    if (fixture.accessMode !== "authorized_export") {
      throw new SocialDataError(
        "INVALID_ACCESS_MODE",
        "AuthorizedExportSocialAdapter requires authorized_export access mode.",
      );
    }
    if (fixture.provenance !== "authorized_export") {
      throw new SocialDataError(
        "MALFORMED_INPUT",
        "Authorized export fixture must use authorized_export provenance.",
      );
    }
    super(input, "authorized_export");
  }
}
