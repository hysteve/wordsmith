import { permanentRedirect } from "next/navigation";

/** Jobs and runs were two views of one timeline; they are combined now. */
export default function JobsPage() {
  permanentRedirect("/activity");
}
