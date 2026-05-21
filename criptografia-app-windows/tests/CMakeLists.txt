cmake_minimum_required(VERSION 3.20)
project(SecureCryptTests LANGUAGES CXX)

set(TEST_SOURCES
    unit/test_crypto.cpp
    unit/test_secure_memory.cpp
    unit/test_password_generator.cpp
    unit/test_string_utils.cpp
    integration/test_database.cpp
    integration/test_file_cipher.cpp
)

add_executable(${PROJECT_NAME} ${TEST_SOURCES})

target_link_libraries(${PROJECT_NAME} PRIVATE
    SecureCrypt
    bcrypt
    crypt32
)

target_include_directories(${PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../src
)

include(CTest)
add_test(NAME CryptoTests COMMAND ${PROJECT_NAME} --test-suite=crypto)
add_test(NAME MemoryTests COMMAND ${PROJECT_NAME} --test-suite=memory)
add_test(NAME PasswordTests COMMAND ${PROJECT_NAME} --test-suite=password)
add_test(NAME DatabaseTests COMMAND ${PROJECT_NAME} --test-suite=database)
add_test(NAME FileCipherTests COMMAND ${PROJECT_NAME} --test-suite=filecipher)
