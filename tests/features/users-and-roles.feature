@administration @users
Feature: Accounts, roles and permissions
  As a tester of a site
  I want to assert the roles of the site, the roles of the accounts and the permissions of the roles
  So that what each role can and cannot do is covered

  # The accounts are created by the site build script; no scenario creates,
  # changes or deletes an account, a role or a permission.

  Background:
    Given I am logged in as "admin"

  @critical
  Scenario: The site has its stock roles
    Then the site should have the role "Anonymous"
    And the site should have the role "Authenticated"
    And the site should have the role "Editor"
    And the site should have the role "Administrator"
    And the site should not have the role "Moderator"

  Scenario: The accounts have the roles the site build script gave them
    Then the account "admin" should have the "Administrator" role
    And the account "editor" should have the "Editor" role
    And the account "editor" should not have the "Administrator" role
    And the account "member" should not have the "Editor" role
    And the account "member" should be active
    And the account "editor" should be active

  @critical
  Scenario: The editor role manages content but not layouts, menus or accounts
    Then the "Editor" role should have the permission "Access the content overview page"
    And the "Editor" role should have the permission "Administer content"
    And the "Editor" role should have the permission "Access administration bar"
    And the "Editor" role should not have the permission "Administer Layouts"
    And the "Editor" role should not have the permission "Administer menus and menu items"
    And the "Editor" role should not have the permission "Administer user accounts"
    And the "Editor" role should not have the permission "Administer permissions"

  Scenario: The other roles have their permissions
    Then the "Administrator" role should have the permission "Administer Layouts"
    And the "Administrator" role should have the permission "Administer permissions"
    And the "Anonymous" role should have the permission "View published content"
    And the "Anonymous" role should not have the permission "Access administration bar"
    And the "Authenticated" role should have the permission "View published content"
    And the "Authenticated" role should not have the permission "Access the content overview page"
