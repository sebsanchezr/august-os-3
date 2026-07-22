import { redirect } from 'next/navigation'

// The Bid Manager is now the Bids section of the single Gov Contracts page.
// This route is kept alive so old links / bookmarks land in the right place.
export default function GovBidManagerRedirect() {
  redirect('/gov-contracts')
}
