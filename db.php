<?php
$host = "sql207.infinityfree.com"; // replace with InfinityFree DB host
$user = "if0_39991264";           // replace with InfinityFree DB username
$pass = "yRIDOwitLUi";          // replace with InfinityFree DB password
$db   = "if0_39991264_if0_38765432";    // replace with InfinityFree DB name

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
?>