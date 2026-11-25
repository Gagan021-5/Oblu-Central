import React from "react";
import CustomerWorkspaceScreen from "@/components/customers/CustomerWorkspaceScreen";

export default function AdminCustomerWorkspaceScreen() {
  return <CustomerWorkspaceScreen isAdmin={true} />;
}
