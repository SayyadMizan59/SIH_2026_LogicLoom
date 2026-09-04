const testAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

async function runE2ETest() {
  console.log("=== 1. Health Check ===");
  const healthRes = await fetch("http://localhost:3000/api/health");
  const healthData = await healthRes.json();
  console.log("Health status:", healthData);

  console.log("\n=== 2. Register Identity (DID) ===");
  const idRes = await fetch("http://localhost:3000/api/identities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: testAddress }),
  });
  const idData = await idRes.json();
  console.log("Identity registration response:", idData);

  console.log("\n=== 3. Mint Digital Asset (Driving License NFT) ===");
  const mintRes = await fetch("http://localhost:3000/api/assets/mint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: testAddress,
      assetType: "Driving License",
      details: {
        licenseNumber: "DL-NY-2026-88192",
        fullName: "Bob Martinez",
        category: "Class C / Passenger",
        issueDate: "2024-06-01",
        expiryDate: "2034-06-01",
        issuingAuthority: "New York DMV"
      },
    }),
  });
  const mintData = await mintRes.json();
  console.log("Mint response:", mintData);

  console.log("\n=== 4. Verify Identity & Credentials ===");
  const verifyRes = await fetch(`http://localhost:3000/api/verify/${testAddress}`);
  const verifyData = await verifyRes.json();
  console.log("Verification response:\n", JSON.stringify(verifyData, null, 2));
}

runE2ETest().catch(console.error);
