import { holdingRoute } from "@/lib/holding-route";

const route = holdingRoute("wishlists", "My Wishlist");

export const GET = route.GET;
export const POST = route.POST;
export const PATCH = route.PATCH;
export const DELETE = route.DELETE;
